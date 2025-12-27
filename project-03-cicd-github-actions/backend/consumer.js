require('dotenv').config();

const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_REGION });

const sqs = new AWS.SQS();
const QUEUE_URL = process.env.AWS_QUEUE_URL;

async function pollQueue() {
  const params = {
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 5,
    WaitTimeSeconds: 10,
  };

  try {
    const data = await sqs.receiveMessage(params).promise();
    if (!data.Messages) return;

    for (const msg of data.Messages) {
      const { type, payload } = JSON.parse(msg.Body);
      console.log('[SQS] Received', type, payload);

      await sqs.deleteMessage({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle,
      }).promise();
      console.log('[SQS] Deleted message:', msg.MessageId);
    }
  } catch (err) {
    console.error('[SQS] Poll error:', err);
  }
}

console.log('📥 SQS consumer started. Polling every 5 seconds...');
setInterval(pollQueue, 5000);
