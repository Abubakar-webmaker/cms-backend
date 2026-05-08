// backend/models/Category.js
const mongoose = require("mongoose");

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

CategorySchema.pre("save", async function () {
  if (!this.isModified("name")) return;

  const baseSlug = slugify(this.name);
  let candidate = baseSlug;
  let counter = 1;

  while (await this.constructor.findOne({ slug: candidate, _id: { $ne: this._id } })) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  this.slug = candidate;
});

module.exports = mongoose.model("Category", CategorySchema);
