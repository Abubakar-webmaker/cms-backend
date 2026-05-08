const express      = require("express");
const mongoose     = require("mongoose");
const dotenv       = require("dotenv");
const cookieParser = require("cookie-parser");
const rateLimit    = require("express-rate-limit");
dotenv.config();

const app = express();
app.disable("x-powered-by");

// ─── CORS Manual ──────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://cms-frontend-three-kohl.vercel.app");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ─── Rate limiters ────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { message: "Too many requests, please try again later." },
});

// ─── Core middleware ──────────────────────────────────────
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

// ─── Legacy routes ────────────────────────────────────────
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
  res.status(500).json({ message: "Server error", error: err.message });
});

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

module.exports = app;