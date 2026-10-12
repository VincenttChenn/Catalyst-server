import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  // Serverless optimization: Reuse existing database connection
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    const uri = process.env.MONGO_URI as string;
    if (!uri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};