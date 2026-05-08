// backend/controllers/postController.js
const sanitizeHtml = require("sanitize-html");
const mongoose     = require("mongoose");
const Post         = require("../models/Post");
const Category     = require("../models/Category");
const { getCache, setCache, clearPattern } = require("../config/cache");

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img", "h1", "h2", "h3", "pre", "code", "blockquote",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "width", "height"],
    "*": ["class"],
  },
};

const listCacheKey = (query = {}) =>
  `posts:list:${JSON.stringify({
    category: query.category || "",
    status: query.status || "",
    tag: query.tag || "",
    q: query.q || "",
    page: query.page || "",
    limit: query.limit || "",
    cursor: query.cursor || "",
  })}`;

const invalidatePostLists = async () => {
  await clearPattern("posts:list:");
};

const resolveCategoryFilter = async (category) => {
  if (!category) return undefined;

  const normalizedCategory = String(category).trim().toLowerCase();
  const clauses = [{ slug: normalizedCategory }];
  if (mongoose.isValidObjectId(category)) {
    clauses.push({ _id: category });
  }

  const cat = await Category.findOne({ $or: clauses }).select("_id");
  return cat?._id || null;
};

// ─── GET all posts (cursor-based + page-based) ────────────
const getPosts = async (req, res) => {
  try {
    const { category, status, tag, q, page, limit = 10, cursor } = req.query;
    const cacheKey = listCacheKey(req.query);
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const filter = { deletedAt: null };
    if (category) {
      filter.category = await resolveCategoryFilter(category);
    }
    if (status) filter.status = status;
    if (tag)    filter.tags = { $in: [tag] };
    if (q) {
      filter.$text = { $search: q };
    }

    const limitNum = Math.min(Number(limit) || 10, 50);

    // Cursor-based pagination
    if (cursor) {
      filter._id = { $lt: cursor };
      const posts = await Post.find(filter)
        .populate("author",   "name email")
        .populate("category", "name slug")
        .sort({ _id: -1 })
        .limit(limitNum);

      const nextCursor = posts.length === limitNum ? posts[posts.length - 1]._id : null;
      const payload = { posts, nextCursor };
      await setCache(cacheKey, payload, 30);
      return res.json(payload);
    }

    // Page-based pagination (default)
    const pageNum = Number(page) || 1;
    const skip    = (pageNum - 1) * limitNum;
    const total   = await Post.countDocuments(filter);
    const posts   = await Post.find(filter)
      .populate("author",   "name email")
      .populate("category", "name slug")
      .sort(q ? { score: { $meta: "textScore" }, createdAt: -1 } : { createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const payload = { posts, total, page: pageNum, totalPages: Math.ceil(total / limitNum) };
    await setCache(cacheKey, payload, 60);
    res.json(payload);
  } catch (err) {
    console.error("[GET POSTS ERROR]", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─── GET single post ──────────────────────────────────────
const getPost = async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, deletedAt: null })
      .populate("author",   "name email")
      .populate("category", "name slug");

    if (!post) return res.status(404).json({ message: "Post not found" });

    await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });
    post.views += 1;

    res.json({ post });
  } catch (err) {
    console.error("[GET POST ERROR]", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─── CREATE post ──────────────────────────────────────────
const createPost = async (req, res) => {
  try {
    const {
      title, body, category, tags, status,
      coverImage, metaTitle, metaDescription, ogImage, scheduledAt,
    } = req.body;

    const cleanBody = sanitizeHtml(body, sanitizeOptions);

    const post = await Post.create({
      title,
      body:            cleanBody,
      category,
      tags:            tags || [],
      status:          status || "draft",
      coverImage:      coverImage || "",
      metaTitle:       metaTitle || "",
      metaDescription: metaDescription || "",
      ogImage:         ogImage || "",
      scheduledAt:     status === "scheduled" ? scheduledAt : null,
      author:          req.user._id,
    });

    await post.populate("author",   "name email");
    await post.populate("category", "name slug");
    await invalidatePostLists();

    res.status(201).json({ post });
  } catch (err) {
    console.error("[CREATE POST ERROR]", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─── UPDATE post ──────────────────────────────────────────
const updatePost = async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, deletedAt: null });
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.author.toString() !== req.user._id.toString() && req.user.role !== "admin")
      return res.status(403).json({ message: "Not authorized" });

    const {
      title, body, category, tags, status,
      coverImage, metaTitle, metaDescription, ogImage, scheduledAt,
    } = req.body;

    if (title !== undefined)           post.title           = title;
    if (body !== undefined)            post.body            = sanitizeHtml(body, sanitizeOptions);
    if (category !== undefined)        post.category        = category;
    if (tags !== undefined)            post.tags            = tags;
    if (status !== undefined)          post.status          = status;
    if (coverImage !== undefined)      post.coverImage      = coverImage;
    if (metaTitle !== undefined)       post.metaTitle       = metaTitle;
    if (metaDescription !== undefined) post.metaDescription = metaDescription;
    if (ogImage !== undefined)         post.ogImage         = ogImage;
    if (status === "scheduled" && scheduledAt) post.scheduledAt = scheduledAt;
    else if (status !== "scheduled")   post.scheduledAt     = null;

    await post.save();
    await post.populate("author",   "name email");
    await post.populate("category", "name slug");
    await invalidatePostLists();

    res.json({ post });
  } catch (err) {
    console.error("[UPDATE POST ERROR]", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─── SOFT DELETE post ─────────────────────────────────────
const deletePost = async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, deletedAt: null });
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.author.toString() !== req.user._id.toString() && req.user.role !== "admin")
      return res.status(403).json({ message: "Not authorized" });

    post.deletedAt = new Date();
    await post.save();
    await invalidatePostLists();

    res.json({ message: "Post deleted (recoverable)" });
  } catch (err) {
    console.error("[DELETE POST ERROR]", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─── RESTORE soft-deleted post ────────────────────────────
const restorePost = async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, deletedAt: { $ne: null } });
    if (!post) return res.status(404).json({ message: "Deleted post not found" });

    post.deletedAt = null;
    post.status    = "draft";
    await post.save();
    await invalidatePostLists();

    res.json({ message: "Post restored", post });
  } catch (err) {
    console.error("[RESTORE POST ERROR]", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─── GET deleted posts (trash) ────────────────────────────
const getDeletedPosts = async (req, res) => {
  try {
    const posts = await Post.find({ deletedAt: { $ne: null } })
      .populate("author",   "name email")
      .populate("category", "name slug")
      .sort({ deletedAt: -1 });

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── GET post version history ─────────────────────────────
const getVersions = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).select("versions title");
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json({ versions: post.versions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getPosts, getPost, createPost, updatePost,
  deletePost, restorePost, getDeletedPosts, getVersions,
};
