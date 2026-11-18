import { Request, Response, NextFunction } from 'express';

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Central error handler. Express 5 forwards rejected promises from async handlers here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  const status = (err as { status?: number }).status ?? 500;

  // malformed JSON bodies surface as a 400 from express.json()
  if (status === 400 && err instanceof SyntaxError) {
    res.status(400).json({ message: 'Malformed JSON body' });
    return;
  }

  console.error(err);
  // SECURITY: never leak internal error details to the client
  res.status(status).json({ message: status === 500 ? 'Internal server error' : err.message });
};
