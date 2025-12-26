const sqs = require('./sqsClient');

const sendToSQS = async (messageBody) => {
  const params = {
    QueueUrl: process.env.AWS_QUEUE_URL,
    MessageBody: JSON.stringify(messageBody)
  };

  try {
    const result = await sqs.sendMessage(params).promise();
    console.log('✅ SQS message sent:', result.MessageId);
  } catch (error) {
    console.error('❌ Error sending message to SQS:', error);
  }
};

module.exports = { sendToSQS };
