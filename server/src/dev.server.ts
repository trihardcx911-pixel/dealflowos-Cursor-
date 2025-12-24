import express from "express";
import cors from "cors";

const app = express();

// CORS - allow Vite dev server
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// GET /api/test
app.get("/api/test", (_req, res) => {
  res.json({ ok: true });
});

// POST /api/auth/login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Email and password are required",
    });
  }

  // Dev mode: always return a token (no database check)
  const token = `dev_token_${Buffer.from(email).toString("base64")}_${Date.now()}`;

  return res.json({
    token,
    user: {
      email,
      id: `user_${Buffer.from(email).toString("base64").substring(0, 8)}`,
    },
  });
});

// POST /api/auth/signup
app.post("/api/auth/signup", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Email and password are required",
    });
  }

  // Dev mode: always return success (no database write)
  return res.json({
    message: "User created successfully",
    user: {
      email,
      id: `user_${Buffer.from(email).toString("base64").substring(0, 8)}`,
    },
  });
});

const PORT = 3010;
app.listen(PORT, () => {
  console.log(">>> DEV SERVER RUNNING ON http://localhost:3010");
});

