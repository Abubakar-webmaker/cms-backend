// backend/routes/posts.js
const express  = require("express");
const router   = express.Router();
const { body } = require("express-validator");
const {
  getPosts, getPost, createPost, updatePost,
  deletePost, restorePost, getDeletedPosts, getVersions,
} = require("../controllers/postController");
const { protect, authorOrAdmin, adminOnly } = require("../middleware/auth");
const validate = require("../middleware/validate");

const postRules = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("body").trim().notEmpty().withMessage("Body is required"),
  body("category").notEmpty().withMessage("Category is required"),
];

router.get("/",              getPosts);
router.get("/trash",         protect, adminOnly, getDeletedPosts);
router.get("/:slug",         getPost);
router.post("/",             protect, authorOrAdmin, postRules, validate, createPost);
router.put("/:id",           protect, authorOrAdmin, postRules, validate, updatePost);
router.delete("/:id",        protect, authorOrAdmin, deletePost);
router.patch("/:id/restore", protect, adminOnly, restorePost);
router.get("/:id/versions",  protect, authorOrAdmin, getVersions);

module.exports = router;
