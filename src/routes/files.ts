import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { PORT } from '../config/env'

const router = Router()

// Configure multer for file uploads
// For now, we'll store files in a local 'uploads' directory
// In production, you should use cloud storage (AWS S3, Cloudinary, etc.)

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-uuid-originalname
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  },
})

// File filter - only allow images and videos
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
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
  ]

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`))
  }
}

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file sizes (for images and videos)
  },
})

/**
 * POST /api/file/upload
 * Upload a single file (image or video)
 * Requires authentication
 * Returns the file URL
 */
router.post('/upload', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('Multer error:', err)
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File too large. Maximum size is 50MB',
          })
        }
        return res.status(400).json({
          success: false,
          error: `Upload error: ${err.message}`,
        })
      }
      // File filter error or other error
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload failed',
      })
    }
    next()
  })
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      })
    }

    // Get authenticated user (optional, for logging)
    let auth: { userId?: string | null } | undefined
    try {
      if (typeof (req as any).auth === 'function') {
        auth = (req as any).auth()
      } else {
        auth = (req as any).auth
      }
    } catch {
      auth = (req as any).auth
    }

    const file = req.file

    // Construct file URL
    // In production, this should be your CDN/cloud storage URL
    // For now, using local file path that can be served statically
    // Use full URL with backend server address
    const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`
    const fileUrl = `${BACKEND_URL}/uploads/${file.filename}`

    console.log(`✅ File uploaded: ${file.originalname} by user ${auth?.userId || 'unknown'}`)
    console.log(`   Saved as: ${file.filename}`)
    console.log(`   Size: ${file.size} bytes`)
    console.log(`   Type: ${file.mimetype}`)

    res.json({
      success: true,
      data: {
        file_url: fileUrl,
        file_id: file.filename,
        file_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
      },
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file',
    })
  }
})

export default router
