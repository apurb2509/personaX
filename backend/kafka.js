const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'personalization-platform',
  brokers: ['kafka:29092'], // Use the INTERNAL port
});

const producer = kafka.producer();

module.exports = { producer };