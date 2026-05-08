// backend/server.js
const express      = require("express");
const mongoose     = require("mongoose");
const cors         = require("cors");
const dotenv       = require("dotenv");
const cookieParser = require("cookie-parser");
const rateLimit    = require("express-rate-limit");
dotenv.config();

const app = express();
app.disable("x-powered-by");

// ─── Rate limiters ────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { message: "Too many auth attempts, please try again later." },
});

// ─── Core middleware ──────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://cms-frontend-three-kohl.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(globalLimiter);

// ─── Request logger ───────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── API v1 Routes ────────────────────────────────────────
app.use("/api/v1/auth",       require("./routes/auth"));
app.use("/api/v1/posts",      require("./routes/posts"));
app.use("/api/v1/categories", require("./routes/categories"));
app.use("/api/v1/comments",   require("./routes/comments"));
app.use("/api/v1/media",      require("./routes/media"));

// ─── Legacy routes (backward compat) ─────────────────────
app.use("/api/auth",       require("./routes/auth"));
app.use("/api/posts",      require("./routes/posts"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/comments",   require("./routes/comments"));
app.use("/api/media",      require("./routes/media"));

// ─── Health check ─────────────────────────────────────────
app.get("/", (req, res) => res.json({ message: "Inkwell API running ✓", version: "1.0" }));

// ─── 404 handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ─── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl} — ${err.message}`);
  if (err.stack) console.error(err.stack);
  res.status(500).json({ message: "Server error", error: err.message });
});

// ─── DB connect + start ───────────────────────────────────
// ─── DB connect ───────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected ✓");
    const { startScheduler } = require("./config/scheduler");
    startScheduler();
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ─── Export for Vercel ────────────────────────────────────
module.exports = app;