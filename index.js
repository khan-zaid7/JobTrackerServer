import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import resumeRoutes from './routes/resume.js';
import matchRoutes from './routes/match.js';
import scrapeRoutes from './routes/scrape.js';

import path from 'path';
import { fileURLToPath } from 'url';
import matchResultsRoutes from './routes/matchResults.js';

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,  // frontend url in production (example: https://jobtrackerclient.onrender.com)
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests like Postman
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.error('MongoDB connection failed:', err));

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/match-results', matchResultsRoutes);
app.use('/api/scrape', scrapeRoutes);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/tailored-resumes', express.static(path.join(__dirname, '/tailored-resumes')));



app.listen(5000, () => console.log('Server running on port 5000'));
