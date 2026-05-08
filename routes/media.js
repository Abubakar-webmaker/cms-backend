// backend/routes/media.js
const express            = require("express");
const router             = express.Router();
const { cloudinary, upload } = require("../config/cloudinary");
const { protect, authorOrAdmin } = require("../middleware/auth");

// Upload single image
router.post("/upload", protect, authorOrAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  res.json({
    url:       req.file.path,
    publicId:  req.file.filename,
    width:     req.file.width,
    height:    req.file.height,
  });
});

// Get media library (all images in inkwell folder)
router.get("/library", protect, authorOrAdmin, async (req, res) => {
  try {
    const { next_cursor } = req.query;
    const result = await cloudinary.search
      .expression("folder:inkwell")
      .sort_by("created_at", "desc")
      .max_results(20)
      .next_cursor(next_cursor || undefined)
      .execute();

    res.json({
      images:     result.resources.map((r) => ({
        url:       r.secure_url,
        publicId:  r.public_id,
        width:     r.width,
        height:    r.height,
        bytes:     r.bytes,
        createdAt: r.created_at,
      })),
      nextCursor: result.next_cursor || null,
    });
  } catch (err) {
    console.error("[MEDIA LIBRARY ERROR]", err.message);
    res.status(500).json({ message: err.message });
  }
});

// Delete image
router.delete("/:publicId", protect, authorOrAdmin, async (req, res) => {
  try {
    await cloudinary.uploader.destroy(req.params.publicId);
    res.json({ message: "Image deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
