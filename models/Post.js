// backend/models/Post.js
const mongoose = require("mongoose");

const slugify = (value) =>
  value.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const VersionSchema = new mongoose.Schema({
  title:     { type: String },
  body:      { type: String },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

async function ensureUniqueSlug(doc) {
  if (!doc.isModified("title") && !doc.isNew) return;

  const baseSlug = slugify(doc.title || "");
  let candidate = baseSlug;
  let counter = 1;

  while (await doc.constructor.findOne({ slug: candidate, _id: { $ne: doc._id } })) {
    candidate = `${baseSlug}-${counter++}`;
  }

  doc.slug = candidate;
}

const PostSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true },
    body:        { type: String, required: true },
    excerpt:     { type: String, default: "" },
    author:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category:    { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    tags:        [{ type: String, trim: true }],
    status:      { type: String, enum: ["draft", "published", "scheduled"], default: "draft" },
    scheduledAt: { type: Date, default: null },
    views:       { type: Number, default: 0 },
    coverImage:  { type: String, default: "" },
    // SEO fields
    metaTitle:       { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    ogImage:         { type: String, default: "" },
    // Soft delete
    deletedAt: { type: Date, default: null },
    // Version history
    versions: [VersionSchema],
  },
  { timestamps: true }
);

// Indexes for performance
PostSchema.index({ status: 1, deletedAt: 1 });
PostSchema.index({ category: 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ title: "text", excerpt: "text", body: "text", tags: "text" });

PostSchema.pre("validate", async function () {
  await ensureUniqueSlug(this);
});

PostSchema.pre("save", async function () {
  if (this.isModified("title")) {
    await ensureUniqueSlug(this);
  }

  if (this.isModified("body")) {
    const plainText = this.body.replace(/<[^>]+>/g, "").trim();
    this.excerpt = plainText.length > 150 ? `${plainText.slice(0, 150)}...` : plainText;
  }

  // Save version snapshot on title/body change (keep last 10)
  if (!this.isNew && (this.isModified("title") || this.isModified("body"))) {
    const original = await this.constructor.findById(this._id).select("title body");
    if (original) {
      this.versions.push({ title: original.title, body: original.body, updatedAt: new Date() });
      if (this.versions.length > 10) this.versions = this.versions.slice(-10);
    }
  }
});

module.exports = mongoose.model("Post", PostSchema);
