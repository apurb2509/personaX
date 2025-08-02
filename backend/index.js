require('dotenv').config();
const express = require('express');
const { producer } = require('./kafka');
const cassandra = require('cassandra-driver');
const { createClient } = require('redis');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3001;

// --- Initialize Clients ---
const redisClient = createClient({ url: 'redis://redis:6379' }); // Changed from default
const cassandraClient = new cassandra.Client({ contactPoints: ['cassandra:9042'], localDataCenter: 'datacenter1' }); // Changed from localhost
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// --- AI Helper Function ---
async function getInterestExplanation(viewHistory) {
  if (!viewHistory || viewHistory.length === 0) {
    return "No activity yet.";
  }
  const itemNames = viewHistory.map(v => v.page_url.split('/').pop().replace(/-/g, ' ')).join(', ');
  const prompt = `Based on a user's viewing history of these items: ${itemNames}. Write a single, short, and friendly sentence describing their likely interests for a recommendation system. Example: 'It looks like you're interested in running shoes and outdoor gear.'`;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Could not generate an explanation at this time.";
  }
}

// --- Main Application Start ---
const startServer = async () => {
  app.use(express.json());
  await Promise.all([producer.connect(), redisClient.connect(), cassandraClient.connect()]);
  console.log('Connected to Kafka, Redis, and Cassandra.');

  // --- API Endpoints ---
  app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Backend is running!' }));

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

  app.get('/api/users/:userId/views', async (req, res) => {
    const { userId } = req.params;
    const cacheKey = `views:${userId}`;
    
    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`CACHE HIT for key: ${cacheKey}`);
        return res.json({ source: 'cache', ...JSON.parse(cachedData) });
      }

      console.log(`CACHE MISS for key: ${cacheKey}. Fetching from database.`);
      const dbResult = await cassandraClient.execute('SELECT * FROM personalization_keyspace.user_views WHERE user_id = ?', [userId], { prepare: true });
      const views = dbResult.rows;
      
      const explanation = await getInterestExplanation(views);

      const responsePayload = { data: views, explanation };
      await redisClient.set(cacheKey, JSON.stringify(responsePayload), { EX: 3600 });

      return res.json({ source: 'database', ...responsePayload });
    } catch (error) {
      console.error('Error fetching user views:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.listen(PORT, () => console.log(`Backend server is listening on port ${PORT}`));
};

startServer();