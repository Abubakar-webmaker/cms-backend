// backend/config/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendCommentNotification = async ({ postTitle, postSlug, commenterName, commentText }) => {
  if (!process.env.SMTP_USER || !process.env.NOTIFY_EMAIL) return;

  await transporter.sendMail({
    from:    `"Inkwell CMS" <${process.env.SMTP_USER}>`,
    to:      process.env.NOTIFY_EMAIL,
    subject: `New comment on "${postTitle}"`,
    html: `
      <h3>New comment on <a href="${process.env.FRONTEND_URL}/post/${postSlug}">${postTitle}</a></h3>
      <p><strong>${commenterName}</strong> wrote:</p>
      <blockquote>${commentText}</blockquote>
      <p><a href="${process.env.FRONTEND_URL}/admin">Review in dashboard</a></p>
    `,
  });
};

const sendReplyNotification = async ({
  postTitle,
  postSlug,
  replierName,
  replyText,
  recipientEmail,
}) => {
  if (!process.env.SMTP_USER || !recipientEmail) return;

  await transporter.sendMail({
    from: `"Inkwell CMS" <${process.env.SMTP_USER}>`,
    to: recipientEmail,
    subject: `New reply on "${postTitle}"`,
    html: `
      <h3>Someone replied to your comment on <a href="${process.env.FRONTEND_URL}/post/${postSlug}">${postTitle}</a></h3>
      <p><strong>${replierName}</strong> replied:</p>
      <blockquote>${replyText}</blockquote>
      <p>Open the post to continue the discussion.</p>
    `,
  });
};

module.exports = { sendCommentNotification, sendReplyNotification };
