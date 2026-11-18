import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

// Usage: npm run make-admin -- someone@example.com
const run = async (): Promise<void> => {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run make-admin -- <email>');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not defined in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    const user = await User.findOneAndUpdate({ email }, { role: 'admin' }, { new: true });
    if (!user) {
      console.error(`No user found with email ${email}. Register the account first.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${user.email} is now an admin`);
  } catch (error) {
    console.error('Failed to promote user:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
