import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/database';
import productRoutes from './routes/productRoutes';
import authRoutes from './routes/authRoutes';
import orderRoutes from './routes/orderRoutes';
import { notFound, errorHandler } from './middleware/errorMiddleware';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET is not defined in .env');
}

connectDB();

const app = express();

// SECURITY: trust proxy for accurate IP tracking behind Railway/Vercel reverse proxy
app.set('trust proxy', 1);

// SECURITY: only trusted origins may call the API from a browser.
// CLIENT_URL may hold several comma-separated origins, e.g. a production and a preview URL.
const allowedOrigins = [
  ...(process.env.CLIENT_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  'http://localhost:5173',
  'https://catalyst-client-marketplace.vercel.app',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // no Origin header = curl, Postman, server-to-server
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
// SECURITY: cap the body size so huge payloads can't be used to exhaust memory
app.use(express.json({ limit: '10kb' }));

// Ensure database is connected for every request in serverless
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Catalyst Backend API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  // readyState 1 = connected
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
  });
});

// SECURITY: rate limit for auth routes — prevent brute force attacks (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per 15 mins
  message: { message: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: general rate limit for catalog browsing & orders
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 mins (generous for shopping & testing)
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', generalLimiter, productRoutes);
app.use('/api/orders', generalLimiter, orderRoutes);

app.use(notFound);
app.use(errorHandler);

// Only listen directly when running in local development (not in serverless environment)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Vercel's @vercel/node runtime uses the default export as the request handler
export default app;
