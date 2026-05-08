// seed.js — run once: node seed.js
require("dotenv").config();
const mongoose = require("mongoose");

const User     = require("./models/User");
const Category = require("./models/Category");
const Post     = require("./models/Post");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected ✓");

  // Clear existing
  await User.deleteMany({});
  await Category.deleteMany({});
  await Post.deleteMany({});
  console.log("Cleared existing data ✓");

  // Admin user
  const admin    = await User.create({
    name: "Admin", email: "admin@inkwell.com",
    password: "admin123", role: "admin",
  });
  console.log("Admin created ✓  →  admin@inkwell.com / admin123");

  // Author user
  const author   = await User.create({
    name: "Ali Khan", email: "ali@inkwell.com",
    password: "author123", role: "author",
  });
  console.log("Author created ✓  →  ali@inkwell.com / author123");

  // Categories
  const cats = await Category.insertMany([
    { name: "Technology", slug: "technology", description: "Tech articles" },
    { name: "Design",     slug: "design",     description: "Design articles" },
    { name: "Career",     slug: "career",     description: "Career tips" },
    { name: "Tutorials",  slug: "tutorials",  description: "Step by step guides" },
  ]);
  console.log("Categories created ✓");

  // Sample posts
  const postsData = [
    {
      title: "How React Server Components change everything",
      body: "React Server Components (RSC) represent one of the biggest shifts in how we build React apps. Instead of sending all your component logic to the browser, server components stay on the server — reducing your JavaScript bundle significantly.\n\nServer components can access databases, file systems, and APIs directly without exposing any of that logic to the client. This means zero client-side JS for server components, faster initial loads, and the ability to mix server and client components in the same tree.",
      category: cats[0]._id, author: author._id,
      tags: ["React", "Server Components", "Performance"],
      status: "published", coverImage: "",
    },
    {
      title: "Tailwind CSS — utility-first design done right",
      body: "Stop writing custom CSS. Tailwind CSS gives you low-level utility classes that let you build completely custom designs without ever leaving your HTML.\n\nThe utility-first approach speeds up your workflow dramatically. Instead of switching between HTML and CSS files, you style everything inline with composable classes. The result is faster development, smaller CSS bundles, and consistent design systems.",
      category: cats[1]._id, author: author._id,
      tags: ["Tailwind", "CSS", "Design"],
      status: "published", coverImage: "",
    },
    {
      title: "Getting your first freelance client as a web developer",
      body: "Portfolio, cold outreach, and Upwork — a guide from someone who has been through it all.\n\nThe biggest mistake new freelancers make is waiting for clients to come to them. You need to go out and find them. Start with your network, build a strong portfolio with 3-5 real projects, and reach out directly to small businesses that need a website.",
      category: cats[2]._id, author: author._id,
      tags: ["Freelance", "Career", "Web Development"],
      status: "published", coverImage: "",
    },
    {
      title: "MongoDB aggregation pipelines explained",
      body: "Aggregation pipelines are one of MongoDB's most powerful features. They allow you to process and transform documents in a collection through a series of stages.\n\nEach stage transforms the documents as they pass through the pipeline. Common stages include $match (filter), $group (aggregate), $sort, $project (reshape), and $lookup (join).",
      category: cats[0]._id, author: admin._id,
      tags: ["MongoDB", "Database", "Backend"],
      status: "draft", coverImage: "",
    },
    {
      title: "Building accessible React components",
      body: "Accessibility is not an afterthought — it should be built into your components from the start. Screen readers, keyboard navigation, and proper ARIA attributes make your app usable for everyone.\n\nStart with semantic HTML. Use button for clickable elements, not div. Add aria-label to icon buttons. Ensure focus is visible and logical.",
      category: cats[1]._id, author: author._id,
      tags: ["React", "Accessibility", "CSS"],
      status: "published", coverImage: "",
    },
  ];

  for (const p of postsData) {
    const slug    = p.title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
    const excerpt = p.body.slice(0, 150) + "...";
    await Post.create({ ...p, slug, excerpt });
  }
  console.log("Sample posts created ✓");

  console.log("\n✅ Seed complete! Login with:");
  console.log("   Admin  → admin@inkwell.com / admin123");
  console.log("   Author → ali@inkwell.com   / author123");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
