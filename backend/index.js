const express = require('express');
const { producer } = require('./kafka');
const cassandra = require('cassandra-driver');
const { createClient } = require('redis');

const app = express();
const PORT = 3001;

// --- Initialize Clients ---
const redisClient = createClient(); // Connects to redis://localhost:6379 by default
const cassandraClient = new cassandra.Client({
  contactPoints: ['localhost:9042'],
  localDataCenter: 'datacenter1',
});

// --- Main Application Start ---
const startServer = async () => {
  app.use(express.json());

  // Connect to all services on startup
  await producer.connect();
  await redisClient.connect();
  await cassandraClient.connect();
  console.log('Connected to Kafka, Redis, and Cassandra.');

  // --- API Endpoints ---
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running!' });
  });

  app.post('/api/events/view', async (req, res) => {
    try {
      await producer.send({
        topic: 'user-views',
        messages: [{ value: JSON.stringify(req.body) }],
      });
      res.status(202).json({ message: 'Event accepted' });
    } catch (error) {
      console.error('Failed to send event to Kafka', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // NEW: Endpoint to get a user's view history (with caching)
  app.get('/api/users/:userId/views', async (req, res) => {
    const { userId } = req.params;
    const cacheKey = `views:${userId}`;

    try {
      // 1. Try to fetch from cache first
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        // CACHE HIT
        console.log(`CACHE HIT for key: ${cacheKey}`);
        return res.json({ source: 'cache', data: JSON.parse(cachedData) });
      }

      // CACHE MISS
      console.log(`CACHE MISS for key: ${cacheKey}. Fetching from database.`);

      // 2. If miss, fetch from Cassandra
      const query = 'SELECT * FROM personalization_keyspace.user_views WHERE user_id = ?';
      const result = await cassandraClient.execute(query, [userId], { prepare: true });
      const views = result.rows;

      // 3. Store the result in the cache for next time (expires in 1 hour)
      await redisClient.set(cacheKey, JSON.stringify(views), { EX: 3600 });

      return res.json({ source: 'database', data: views });
    } catch (error) {
      console.error('Error fetching user views:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.listen(PORT, () => {
    console.log(`Backend server is listening on http://localhost:${PORT}`);
  });
};

startServer();