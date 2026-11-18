import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';

// helper - for email validation
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const signToken = (userId: unknown): string =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET as string, {
    expiresIn: '7d' as jwt.SignOptions['expiresIn'],
  });

const publicUser = (user: { _id: unknown; name: string; email: string; role: string }) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body ?? {};

    // SECURITY: server-side validation (cannot be bypassed like frontend validation)
    if (!name || !email || !password) {
      res.status(400).json({ message: 'Name, email, and password are required' });
      return;
    }
    if (typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ message: 'Name must be at least 2 characters' });
      return;
    }
    if (typeof email !== 'string' || !isValidEmail(email.trim())) {
      res.status(400).json({ message: 'Invalid email format' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(400).json({ message: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password: hashedPassword });

    res.status(201).json({ token: signToken(user._id), user: publicUser(user) });
  } catch (error) {
    
    res.status(500).json({ message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};

    // SECURITY: server-side validation
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }
    if (typeof email !== 'string' || !isValidEmail(email.trim())) {
      res.status(400).json({ message: 'Invalid email format' });
      return;
    }
    if (typeof password !== 'string') {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    // password is `select: false` on the schema, so it must be requested explicitly
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    res.status(200).json({ token: signToken(user._id), user: publicUser(user) });
  } catch (error) {
    // SECURITY: do not send raw error — it may leak internal server details
    res.status(500).json({ message: 'Login failed' });
  }
};

// GET /api/auth/me  returns the currently authenticated user
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json({ user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
};

// PATCH /api/auth/me/password change password (requires the current one)
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ message: 'currentPassword and newPassword are required' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ message: 'New password must be at least 8 characters' });
      return;
    }
    if (newPassword === currentPassword) {
      res.status(400).json({ message: 'New password must be different from the current one' });
      return;
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update password' });
  }
};
