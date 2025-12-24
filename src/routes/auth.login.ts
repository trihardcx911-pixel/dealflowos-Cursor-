/**
 * Auth Login Router
 * Simple dev-mode login that returns a fake JWT
 */

import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/login
 * Dev-mode login endpoint that returns a fake JWT
 */
router.post("/login", async (req, res, next) => {
  try {
    console.log("[AUTH LOGIN] POST /login reached");
    console.log("[AUTH LOGIN] Request body:", req.body);
    console.log("[AUTH LOGIN] DEV_AUTH_BYPASS:", env.DEV_AUTH_BYPASS);

    const { email, password } = loginSchema.parse(req.body);

    // Dev mode: return fake JWT
    if (env.DEV_AUTH_BYPASS === true) {
      const token = `dev_token_${Buffer.from(email).toString("base64")}_${Date.now()}`;
      
      console.log("[AUTH LOGIN] Dev mode - returning fake token");
      
      return res.json({
        token,
        user: {
          email,
          id: `user_${Buffer.from(email).toString("base64").substring(0, 8)}`,
        },
      });
    }

    // Production mode: not implemented
    console.log("[AUTH LOGIN] Production mode - auth not implemented");
    return res.status(501).json({
      error: "AUTH_NOT_IMPLEMENTED",
      message: "Authentication is not yet implemented. Set DEV_AUTH_BYPASS=true for development.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid email or password format",
        details: err.errors,
      });
    }
    next(err);
  }
});

/**
 * POST /api/auth/signup
 * Dev-mode signup endpoint (placeholder)
 */
router.post("/signup", async (req, res, next) => {
  try {
    console.log("[AUTH SIGNUP] POST /signup reached");
    
    const { email, password } = loginSchema.parse(req.body);

    // Dev mode: just return success
    if (env.DEV_AUTH_BYPASS === true) {
      return res.json({
        message: "User created successfully",
        user: {
          email,
          id: `user_${Buffer.from(email).toString("base64").substring(0, 8)}`,
        },
      });
    }

    // Production mode: not implemented
    return res.status(501).json({
      error: "AUTH_NOT_IMPLEMENTED",
      message: "User registration is not yet implemented. Set DEV_AUTH_BYPASS=true for development.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid email or password format",
        details: err.errors,
      });
    }
    next(err);
  }
});

export const authLoginRouter = router;







