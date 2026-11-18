import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  userId?: string;
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as unknown as { id: string };
    req.userId = decoded.id;
    next();
  } catch (error) {
    // SECURITY: do not send raw error — it may leak internal server details
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Looks the role up in the database on every call, so demoting an admin takes effect
// immediately instead of waiting for their JWT to expire.
export const isAdminUser = async (userId?: string): Promise<boolean> => {
  if (!userId) return false;
  const user = await User.findById(userId).select('role');
  return user?.role === 'admin';
};

// Use AFTER `protect`: router.post('/', protect, adminOnly, handler)
export const adminOnly = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await isAdminUser(req.userId))) {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify permissions' });
  }
};
