// backend/routes/comments.js
const express  = require("express");
const router   = express.Router();
const { body } = require("express-validator");
const sanitizeHtml = require("sanitize-html");
const Comment  = require("../models/Comment");
const Post     = require("../models/Post");
const { protect, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { sendCommentNotification, sendReplyNotification } = require("../config/mailer");

const commentRules = [
  body("post").notEmpty().withMessage("Post ID is required"),
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("text").trim().notEmpty().withMessage("Comment text is required"),
];

const normalizeComment = (value = "") =>
  sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();

const detectSpam = ({ name = "", email = "", text = "" }) => {
  const content = `${name} ${email} ${text}`.toLowerCase();
  const linkCount = (content.match(/https?:\/\//g) || []).length;
  const spamKeywords = [
    "casino", "viagra", "loan", "crypto", "bitcoin", "forex",
    "buy now", "make money fast", "work from home", "click here",
  ];

  if (linkCount > 2) return "too many links";
  if (spamKeywords.some((word) => content.includes(word))) return "spam keyword";
  if (/(.)\1{7,}/.test(content)) return "repeated characters";
  return "";
};

// Admin — get all comments
router.get("/admin/all", protect, adminOnly, async (req, res) => {
  try {
    const comments = await Comment.find()
      .populate("post",   "title slug")
      .populate("parent", "text")
      .sort({ createdAt: -1 });
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/admin/queue", protect, adminOnly, async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const filter = {};
    if (status && status !== "all") filter.moderationStatus = status;
    const comments = await Comment.find(filter)
      .populate("post", "title slug")
      .populate("parent", "text")
      .sort({ createdAt: -1 });
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — approve/unapprove
router.patch("/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    const nextApproved = typeof req.body.approved === "boolean" ? req.body.approved : !comment.approved;
    comment.approved = nextApproved;
    comment.moderationStatus = nextApproved ? "approved" : "pending";
    if (nextApproved) comment.spamReason = "";
    await comment.save();
    res.json({ comment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["pending", "approved", "spam"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid moderation status" });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.moderationStatus = status;
    comment.approved = status === "approved";
    if (status !== "spam") comment.spamReason = "";
    await comment.save();

    res.json({ comment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin — delete
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ message: "Comment deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public — get approved comments for a post (nested)
router.get("/:postId", async (req, res) => {
  try {
    const topLevel = await Comment.find({
      post: req.params.postId, approved: true, parent: null,
    }).sort({ createdAt: -1 });

    const withReplies = await Promise.all(
      topLevel.map(async (c) => {
        const replies = await Comment.find({ parent: c._id, approved: true }).sort({ createdAt: 1 });
        return { ...c.toObject(), replies };
      })
    );

    res.json({ comments: withReplies });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public — post a comment
router.post("/", commentRules, validate, async (req, res) => {
  try {
    const { post: postId, name, email, text, parent } = req.body;
    const cleanName = normalizeComment(name);
    const cleanEmail = normalizeComment(email);
    const cleanText = normalizeComment(text);
    const spamReason = detectSpam({ name: cleanName, email: cleanEmail, text: cleanText });
    const moderationStatus = spamReason ? "spam" : "pending";

    const comment = await Comment.create({
      post: postId,
      name: cleanName,
      email: cleanEmail,
      text: cleanText,
      parent:   parent || null,
      approved: false,
      moderationStatus,
      spamReason,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    });

    // Send email notification (non-blocking)
    Post.findById(postId).select("title slug").then(async (post) => {
      if (!post) return;

      if (moderationStatus === "spam") {
        return;
      }

      if (parent) {
        const parentComment = await Comment.findById(parent).select("email name");
        if (parentComment?.email) {
          sendReplyNotification({
            postTitle: post.title,
            postSlug: post.slug,
            replierName: name,
            replyText: text,
            recipientEmail: parentComment.email,
          }).catch(() => {});
        }
        return;
      }

      sendCommentNotification({
        postTitle:     post.title,
        postSlug:      post.slug,
        commenterName: cleanName,
        commentText:   cleanText,
      }).catch(() => {});
    });

    res.status(201).json({
      comment,
      moderationStatus,
      message: moderationStatus === "spam"
        ? "Comment flagged as spam and sent to moderation."
        : "Comment posted! It will appear after approval.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
