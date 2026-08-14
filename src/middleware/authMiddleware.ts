import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
    userId?: string;
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction ): void => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'No token provided' })
        return
    }

    const token = authHeader.split(' ')[1]

    if (!token) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }


    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as unknown as { id: string }
        req.userId = decoded.id
        next()
    } catch (error) {
        // SECURITY: do not send raw error — it may leak internal server details
        res.status(401).json({ message: 'Invalid or expired token' })
    }
}