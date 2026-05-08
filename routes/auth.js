// backend/routes/auth.js
const express  = require("express");
const router   = express.Router();
const rateLimit = require("express-rate-limit");
const { body } = require("express-validator");
const { register, login, refreshToken, logoutUser, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate    = require("../middleware/validate");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
});

const registerRules = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

const loginRules = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

const maybeLoginLimiter =
  process.env.NODE_ENV === "production"
    ? loginLimiter
    : (req, res, next) => next();

router.post("/register", registerRules, validate, register);
router.post("/login",    maybeLoginLimiter, loginRules, validate, login);
router.post("/refresh",  refreshToken);
router.post("/logout",   logoutUser);
router.get("/me",        protect, getMe);

module.exports = router;
