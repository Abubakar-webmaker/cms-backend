const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { Readable } = require("stream");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "inkwell",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
        transformation: [{ width: 1200, crop: "limit", quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
};

module.exports = { cloudinary, upload, uploadToCloudinary };