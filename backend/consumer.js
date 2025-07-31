const { Kafka } = require('kafkajs');
const cassandra = require('cassandra-driver');
const { v4: uuidv4 } = require('uuid'); // We'll use UUIDs for unique event IDs

// --- Kafka Client Setup ---
const kafka = new Kafka({
  clientId: 'event-consumer',
  brokers: ['localhost:9092'],
});
const consumer = kafka.consumer({ groupId: 'analytics-group' });

// --- Cassandra Client Setup ---
const cassandraClient = new cassandra.Client({
  contactPoints: ['localhost:9042'],
  localDataCenter: 'datacenter1', // Default for the official Docker image
});

// --- Main Application Logic ---
const run = async () => {
  // 1. Connect to services
  await consumer.connect();
  await cassandraClient.connect();
  console.log('Successfully connected to Kafka and Cassandra.');

  // 2. Ensure database schema exists (Keyspace and Table)
  await cassandraClient.execute(`
    CREATE KEYSPACE IF NOT EXISTS personalization_keyspace
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'};
  `);
  await cassandraClient.execute(`
    CREATE TABLE IF NOT EXISTS personalization_keyspace.user_views (
      event_id uuid,
      user_id text,
      page_url text,
      event_time timestamp,
      PRIMARY KEY (user_id, event_time)
    ) WITH CLUSTERING ORDER BY (event_time DESC);
  `);
  console.log('Database schema is ready.');

  // 3. Subscribe to the Kafka topic
  await consumer.subscribe({ topic: 'user-views', fromBeginning: true });
  console.log('Consumer is listening for events on "user-views" topic...');

  // 4. Run the consumer to process messages
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log('✅ Received new event:');
      const eventData = JSON.parse(message.value.toString());
      console.log({ value: eventData });

      // Insert the event into Cassandra
      const query = 'INSERT INTO personalization_keyspace.user_views (event_id, user_id, page_url, event_time) VALUES (?, ?, ?, ?)';
      const params = [uuidv4(), eventData.userId, eventData.pageUrl, new Date()];
      await cassandraClient.execute(query, params, { prepare: true });

      console.log('📝 Saved event to Cassandra.');
    },
  });
};

run().catch(async (error) => {
  console.error('An error occurred:', error);
  await consumer.disconnect();
  await cassandraClient.shutdown();
  process.exit(1);
});

// Add uuid to your project if it's not already there
// In the terminal (in backend folder): npm install uuid