// backend/middleware/auth.js
const jwt  = require("jsonwebtoken");
const User = require("../models/User");

// ─── Protect — login zaroori hai ──────────────────────────
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    console.warn(`[AUTH BLOCKED] Missing Bearer token on ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user      = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      console.warn(`[AUTH BLOCKED] User not found for token id=${decoded.id} on ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ message: "User not found" });
    }
    next();
  } catch (err) {
    console.warn(`[AUTH BLOCKED] Invalid/expired token on ${req.method} ${req.originalUrl}: ${err.message}`);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
  } catch {
    req.user = null;
  }

  next();
};

// ─── Admin only ───────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  return res.status(403).json({ message: "Admin access required" });
};

// ─── Author or Admin ──────────────────────────────────────
const authorOrAdmin = (req, res, next) => {
  if (req.user?.role === "admin" || req.user?.role === "author") return next();
  return res.status(403).json({ message: "Author access required" });
};

module.exports = { protect, optionalAuth, adminOnly, authorOrAdmin };
