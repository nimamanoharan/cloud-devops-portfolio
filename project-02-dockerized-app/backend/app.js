// Import necessary modules
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');

// ✅ Import SQS utility
const { sendToSQS } = require('./utils/sqsClient');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI ;
if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined in environment variables");
}
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB connected');
  Transaction.find({})
    .then(transactions => {
      console.log('Transactions:', transactions);
    })
    .catch(err => {
      console.error('Error fetching transactions:', err);
    });
})
.catch(err => {
  console.error('Error connecting to MongoDB:', err);
});

// MongoDB Schema
const transactionSchema = new mongoose.Schema({
  type: String,
  amount: Number,
  balance: Number,
  timestamp: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});

// ✅ Credit API
app.post('/credit', async (req, res) => {
  const { amount } = req.body;
  if (amount < 0) {
    return res.status(400).send('Please enter a valid amount');
  }
  try {
    const newTransaction = new Transaction({ type: 'Credit', amount });
    await newTransaction.save();

    const transactions = await Transaction.find();
    const totalCredit = transactions.reduce((acc, curr) => curr.type === 'Credit' ? acc + curr.amount : acc, 0);
    const totalDebit = transactions.reduce((acc, curr) => curr.type === 'Debit' ? acc + curr.amount : acc, 0);
    const totalBalance = totalCredit - totalDebit;

    newTransaction.balance = totalBalance;
    await newTransaction.save();

    // ✅ Send message to SQS
    console.log('📤 Attempting to send SQS message...');
    await sendToSQS({
      type: 'CREDIT',
      payload: {
        transactionId: newTransaction._id,
        amount: newTransaction.amount,
        balance: newTransaction.balance,
        timestamp: newTransaction.timestamp
      }
    });

    res.send(`Credit successful. Amount: ${amount}`);
    console.log(`Credit Transaction: Amount = ${amount}, New Balance = ${newTransaction.balance}`);
  } catch (error) {
    console.error('Credit error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ Debit API
app.post('/debit', async (req, res) => {
  const { amount } = req.body;
  if (amount < 0) {
    return res.status(400).send('Please enter a valid amount');
  }
  try {
    const transactions = await Transaction.find();
    const totalCredit = transactions.reduce((acc, curr) => curr.type === 'Credit' ? acc + curr.amount : acc, 0);
    const totalDebit = transactions.reduce((acc, curr) => curr.type === 'Debit' ? acc + curr.amount : acc, 0);
    const totalBalance = totalCredit - totalDebit;

    if (amount > totalBalance) {
      return res.status(400).send('Insufficient balance');
    }

    const newTransaction = new Transaction({ type: 'Debit', amount });
    await newTransaction.save();

    newTransaction.balance = totalBalance - amount;
    await newTransaction.save();

    // ✅ Send message to SQS
    await sendToSQS({
      type: 'DEBIT',
      payload: {
        transactionId: newTransaction._id,
        amount: newTransaction.amount,
        balance: newTransaction.balance,
        timestamp: newTransaction.timestamp
      }
    });

    res.send(`Debit successful. Amount: ${amount}`);
    console.log(`Debit Transaction: Amount = ${amount}, New Balance = ${newTransaction.balance}`);
  } catch (error) {
    console.error('Debit error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Balance API
app.get('/balance', async (req, res) => {
  try {
    const transactions = await Transaction.find();
    const latestTransaction = transactions[transactions.length - 1];
    const balance = latestTransaction ? latestTransaction.balance : 0;
    res.send(`Total Balance: ${balance}`);
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
});

// Transaction history API
app.get('/history', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ timestamp: 'desc' });
    res.json(transactions);
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
