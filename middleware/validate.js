// middleware/validate.js
const { validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    console.error(`\n[VALIDATION ERROR] ${req.method} ${req.originalUrl}`);
    messages.forEach((m) => console.error(`  ✗ ${m}`));
    return res.status(422).json({ message: messages[0], errors: messages });
  }
  next();
};

module.exports = validate;
