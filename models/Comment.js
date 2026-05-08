// backend/models/Comment.js
const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "" },
    text: { type: String, required: true, trim: true },
    approved: { type: Boolean, default: false },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "spam"],
      default: "pending",
    },
    spamReason: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", CommentSchema);
