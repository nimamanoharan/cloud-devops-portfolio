const AWS = require('aws-sdk');
require('dotenv').config();

AWS.config.update({
  region: process.env.AWS_REGION,
});

const sqs = new AWS.SQS();
const QUEUE_URL = process.env.AWS_QUEUE_URL;

async function sendToSQS(message) {
  if (!QUEUE_URL) {
    console.warn('AWS_QUEUE_URL not configured—skipping message send.');
    return;
  }

  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: QUEUE_URL,
  };

  try {
    const { MessageId } = await sqs.sendMessage(params).promise();
    console.log(`[SQS] Sent message: ${MessageId}`);
  } catch (err) {
    console.error('[SQS] Send failed:', err);
  }
}

module.exports = { sendToSQS };
