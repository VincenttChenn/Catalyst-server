import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/database';
import productRoutes from './routes/productRoutes';
import authRoutes from './routes/authRoutes';
import orderRoutes from './routes/orderRoutes';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET is not defined in .env');
}

connectDB();

const app = express();

// SECURITY: trust proxy for accurate IP tracking behind Railway/Vercel reverse proxy
app.set('trust proxy', 1);

// SECURITY: flexible CORS allowing localhost, live frontend, and Vercel domains
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'https://catalyst-client-marketplace.vercel.app',
    ].filter(Boolean);

    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));
app.use(express.json());

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
  res.json({
    status: 'ok',
    database: 'connected',
  });
});

// SECURITY: rate limit for auth routes — prevent brute force attacks (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 attempts per 15 mins
  message: { message: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: general rate limit for catalog browsing & orders
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                 // 1000 requests per 15 mins (generous for shopping & testing)
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', generalLimiter, productRoutes);
app.use('/api/orders', generalLimiter, orderRoutes);

// Only listen directly when running in local development (not in serverless environment)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
