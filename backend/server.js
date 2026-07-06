/**
 * What it does: Entry point for the Express server, handling CORS, JSON middleware, MongoDB connection, and server startup.
 * Why it exists: Bootstraps the backend infrastructure to serve extension requests and run background scheduler jobs.
 * Connects to: MongoDB via Mongoose, .env config, and future API routes/cron jobs.
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const errorHandler = require('./src/middleware/errorHandler');
const sitesRouter = require('./src/routes/sites');
const { startRecheckCronJob } = require('./src/jobs/recheckJob');

const app = express();

const corsConfiguration = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN
    : '*'
};

app.use(cors(corsConfiguration));
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Privacy Policy Tracker API service is active.',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/sites', sitesRouter);
app.use(errorHandler);

async function connectToDatabase() {
  try {
    const databaseConnectionUri = process.env.MONGO_URI;
    if (!databaseConnectionUri) {
      throw new Error('Database connection string MONGO_URI is not defined in environment variables.');
    }
    await mongoose.connect(databaseConnectionUri);
    console.log('[Database] Connected successfully to MongoDB.');
  } catch (error) {
    console.error(`[Database Error] Failed to establish MongoDB connection: ${error.message}`);
    process.exit(1);
  }
}

async function bootstrapServer() {
  try {
    await connectToDatabase();
    const serverPort = process.env.PORT || 5000;
    app.listen(serverPort, () => {
      console.log(`[Server] API server listening on port ${serverPort} in ${process.env.NODE_ENV || 'development'} mode.`);
      startRecheckCronJob();
    });
  } catch (error) {
    console.error(`[Server Error] Fatal failure during server bootstrap: ${error.message}`);
    process.exit(1);
  }
}

bootstrapServer();

module.exports = app;
