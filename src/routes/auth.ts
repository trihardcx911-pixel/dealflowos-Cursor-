import { Router } from "express";
import { Pool } from "pg";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function makeAuthRouter(pool: Pool) {
  const router = Router();

  // POST /auth/login
  router.post("/login", async (req, res, next) => {
    console.log('[AUTH] POST /login reached');
    console.log('[AUTH] Request body:', req.body);
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      // For development: return a simple token
      // In production, this would verify against a users table
      const token = `dev_token_${Buffer.from(email).toString('base64')}_${Date.now()}`;
      console.log('[AUTH] Login successful, sending token');
      res.json({ token });
    } catch (err) {
      next(err);
    }
  });

  // POST /auth/signup
  router.post("/signup", async (req, res, next) => {
    try {
      const { email, password } = signupSchema.parse(req.body);
      
      // For development: just return success
      // In production, this would create a user in the database
      res.json({ message: "User created" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

