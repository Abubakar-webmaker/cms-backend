// backend/controllers/authController.js
const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const generateAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "15m",
  });

const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "30d" });

const setRefreshCookie = (res, token) =>
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

// ─── Register ─────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!name || !email || !password) {
      console.warn(`[REGISTER VALIDATION] Missing fields for email="${email || "n/a"}"`);
      return res.status(400).json({ message: "All fields are required" });
    }

    if (await User.findOne({ email })) {
      console.warn(`[REGISTER CONFLICT] Email already registered: ${email}`);
      return res.status(400).json({ message: "Email already registered" });
    }

    const user         = await User.create({ name, email, password });
    const token        = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({ user, token });
  } catch (err) {
    console.error("[REGISTER ERROR]", err.message);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

// ─── Login ────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      console.warn(`[LOGIN VALIDATION] Missing email/password for request ${req.ip || "unknown-ip"}`);
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      console.warn(`[LOGIN FAILED] Unknown email: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordOk = await user.matchPassword(password);
    if (!passwordOk) {
      console.warn(`[LOGIN FAILED] Password mismatch for email: ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token        = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    setRefreshCookie(res, refreshToken);

    res.json({ user, token });
  } catch (err) {
    console.error("[LOGIN ERROR]", err.message);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

// ─── Refresh Token ────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      console.warn(`[REFRESH FAILED] No refresh token from ${req.ip || "unknown-ip"}`);
      return res.status(401).json({ message: "No refresh token" });
    }

    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user) {
      console.warn(`[REFRESH FAILED] User not found for token id: ${decoded.id}`);
      return res.status(401).json({ message: "User not found" });
    }

    const newAccessToken  = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    setRefreshCookie(res, newRefreshToken);

    res.json({ token: newAccessToken, user });
  } catch (err) {
    console.warn(`[REFRESH FAILED] ${err.message}`);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

// ─── Logout ───────────────────────────────────────────────
const logoutUser = (req, res) => {
  res.clearCookie("refreshToken", { httpOnly: true, sameSite: "strict" });
  res.json({ message: "Logged out" });
};

// ─── Get current user ─────────────────────────────────────
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { register, login, refreshToken, logoutUser, getMe };
