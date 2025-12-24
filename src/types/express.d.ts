export {}; // make this file a module

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: { userId: string; email: string; orgId: string };
      context?: { userId: string; orgId: string };
      user?: { id: string; email: string };
    }
  }
}
