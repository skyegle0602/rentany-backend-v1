"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clerk_1 = require("../middleware/clerk");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
// Configure multer for file uploads
// For now, we'll store files in a local 'uploads' directory
// In production, you should use cloud storage (AWS S3, Cloudinary, etc.)
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Configure storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-uuid-originalname
        const uniqueName = `${Date.now()}-${(0, uuid_1.v4)()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});
// File filter - only allow images and videos
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        // Images
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        // Videos
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'video/webm',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`));
    }
};
// Configure multer
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
});
/**
 * POST /api/file/upload
 * Upload a single file (image or video)
 * Requires authentication
 * Returns the file URL
 */
router.post('/upload', clerk_1.requireAuth, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err instanceof multer_1.default.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        error: 'File too large. Maximum size is 50MB',
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: `Upload error: ${err.message}`,
                });
            }
            // File filter error or other error
            return res.status(400).json({
                success: false,
                error: err.message || 'File upload failed',
            });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded',
            });
        }
        // Get authenticated user (optional, for logging)
        let auth;
        try {
            if (typeof req.auth === 'function') {
                auth = req.auth();
            }
            else {
                auth = req.auth;
            }
        }
        catch {
            auth = req.auth;
        }
        const file = req.file;
        // Construct file URL
        // In production, this should be your CDN/cloud storage URL
        // For now, using local file path that can be served statically
        // Use full URL with backend server address
        const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${env_1.PORT}`;
        const fileUrl = `${BACKEND_URL}/uploads/${file.filename}`;
        console.log(`✅ File uploaded: ${file.originalname} by user ${auth?.userId || 'unknown'}`);
        console.log(`   Saved as: ${file.filename}`);
        console.log(`   Size: ${file.size} bytes`);
        console.log(`   Type: ${file.mimetype}`);
        res.json({
            success: true,
            data: {
                file_url: fileUrl,
                file_id: file.filename,
                file_name: file.originalname,
                file_size: file.size,
                file_type: file.mimetype,
            },
        });
    }
    catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload file',
        });
    }
});
exports.default = router;
//# sourceMappingURL=files.js.map