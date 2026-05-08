// backend/routes/categories.js
const express   = require("express");
const router    = express.Router();
const { body }  = require("express-validator");
const Category  = require("../models/Category");
const Post      = require("../models/Post");
const { protect, adminOnly } = require("../middleware/auth");
const validate               = require("../middleware/validate");

const catRules = [
  body("name").trim().notEmpty().withMessage("Category name is required"),
];

router.get("/", async (req, res) => {
  try {
    const [categories, counts] = await Promise.all([
      Category.find().sort({ name: 1 }),
      Post.aggregate([
        { $group: { _id: "$category", postCount: { $sum: 1 } } },
      ]),
    ]);

    const countMap = counts.reduce((acc, item) => {
      acc[String(item._id)] = item.postCount;
      return acc;
    }, {});

    res.json({
      categories: categories.map((category) => ({
        ...category.toObject(),
        postCount: countMap[String(category._id)] || 0,
      })),
    });
  } catch (err) {
    console.error("[DB ERROR] GET /categories:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/", protect, adminOnly, catRules, validate, async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = new Category({ name, description });
    await category.save();
    res.status(201).json({ category });
  } catch (err) {
    console.error("[DB ERROR] POST /categories:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", protect, adminOnly, catRules, validate, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    if (req.body.name !== undefined) category.name = req.body.name;
    if (req.body.description !== undefined) category.description = req.body.description;

    await category.save();
    res.json({ category });
  } catch (err) {
    console.error("[DB ERROR] PUT /categories/:id:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("[DB ERROR] DELETE /categories/:id:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
