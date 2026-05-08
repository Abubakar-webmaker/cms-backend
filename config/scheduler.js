// backend/config/scheduler.js
const cron = require("node-cron");
const Post = require("../models/Post");

const startScheduler = () => {
  // Run every minute — publish scheduled posts whose time has come
  cron.schedule("* * * * *", async () => {
    try {
      const result = await Post.updateMany(
        { status: "scheduled", scheduledAt: { $lte: new Date() }, deletedAt: null },
        { $set: { status: "published", scheduledAt: null } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[SCHEDULER] Published ${result.modifiedCount} scheduled post(s)`);
      }
    } catch (err) {
      console.error("[SCHEDULER ERROR]", err.message);
    }
  });

  console.log("Post scheduler started ✓");
};

module.exports = { startScheduler };
