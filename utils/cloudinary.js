const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper function to create storage for specific folders
const createCloudinaryStorage = (folderName) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `campusflow/${folderName}`, // Keeps campusflow separate from fixigo app
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'mp4'],
      // PDF and video files often require raw or video resource_type
      // but CloudinaryStorage auto-detects it in recent versions if we don't strict it
    }
  });
};

module.exports = {
  cloudinary,
  createCloudinaryStorage
};
