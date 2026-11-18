import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'user' | 'admin';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    // lowercase + trim so "A@x.com" and "a@x.com" cannot register as two users
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // never returned by queries unless explicitly requested with .select('+password')
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', userSchema);
