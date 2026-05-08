// repair-auth-users.js
require("dotenv").config();
const mongoose = require("mongoose");

const User = require("./models/User");

async function repairAuthUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected ✓");

  const admin = (await User.findOne({ email: "admin@inkwell.com" })) || new User({ email: "admin@inkwell.com" });
  admin.name = "Admin";
  admin.role = "admin";
  admin.password = "admin123";
  await admin.save();
  console.log("Admin repaired ✓  →  admin@inkwell.com / admin123");

  const author = (await User.findOne({ email: "ali@inkwell.com" })) || new User({ email: "ali@inkwell.com" });
  author.name = "Ali Khan";
  author.role = "author";
  author.password = "author123";
  await author.save();
  console.log("Author repaired ✓  →  ali@inkwell.com / author123");

  await mongoose.disconnect();
  process.exit(0);
}

repairAuthUsers().catch((err) => {
  console.error("Repair failed:", err.message);
  process.exit(1);
});
