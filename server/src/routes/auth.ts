import express from "express";

export const authRouter = express.Router();

// --- POST /auth/login ---
authRouter.post("/login", (req, res) => {
  console.log('[AUTH] POST /login reached');
  console.log('[AUTH] Request body:', req.body);
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ 
      error: "Email and password are required" 
    });
  }

  // Mock login - return static user with token
  console.log('[AUTH] Login successful, sending response');
  res.json({
    token: "mock-jwt-token-" + Date.now(),
    user: {
      email: email,
      id: "1"
    }
  });
});

// --- POST /auth/signup ---
authRouter.post("/signup", (req, res) => {
  console.log('[AUTH] POST /signup reached');
  console.log('[AUTH] Request body:', req.body);
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ 
      error: "Email and password are required" 
    });
  }

  // Mock signup - return success
  res.status(201).json({
    success: true,
    message: "User created successfully"
  });
});



