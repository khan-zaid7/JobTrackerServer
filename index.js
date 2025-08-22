import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Route Imports ---
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import resumeRoutes from './routes/resume.js';
import matchRoutes from './routes/match.js';
import scrapeRoutes from './routes/scrape.js';
import pipelineRoutes from './routes/pipelineSession.js';
import campaignsRoutes from './routes/campaigns.js';
import matchResultsRoutes from './routes/matchResults.js';

// --- Service Imports ---
import { connectToQueue } from './services/queue.js';

// --- Initial Setup ---
dotenv.config();
const app = express();

// --- Middleware Setup ---
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
app.use(express.json());

// --- Route Definitions ---
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/match-results', matchResultsRoutes);
app.use('/api/scrape', scrapeRoutes);
app.use('/api/pipeline-session/', pipelineRoutes);
app.use('/api/campaigns', campaignsRoutes);

// --- Static File Serving ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/tailored-resumes', express.static(path.join(__dirname, '/tailored-resumes')));

// =================================================================
//                 NEW ASYNCHRONOUS SERVER STARTUP
// This function ensures all essential services are connected before
// the server starts accepting HTTP requests.
// =================================================================
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    // The server will wait here until the database connection is established.
    await mongoose.connect(process.env.MONGO_URL);
    console.log('[API-Server] ✅ MongoDB Connected');

    // 2. Connect to RabbitMQ
    // The server will wait here until the message queue connection is established.
    await connectToQueue();
    console.log('[API-Server] ✅ RabbitMQ Connected');

    // 3. Start the Express Server
    // Only after all connections are successful, we start listening for requests.
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`[API-Server] 🚀 Server is up and listening on port ${PORT}`);
    });

  } catch (error) {
    // If any of the essential connections fail, we log the error and exit.
    console.error('[API-Server] 🔥 FATAL: Failed to start server.');
    console.error(error);
    process.exit(1);
  }
};

// --- Execute the startup function ---
startServer();