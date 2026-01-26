import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import multer from 'multer'
import path from 'path'
import { uploadToS3 } from '../services/s3'

const router = Router()

// Configure multer to use memory storage (we'll upload to S3)
// Files are stored in memory as Buffer before uploading to S3
const storage = multer.memoryStorage()

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

    // Determine if file is image or video
    const isVideo = file.mimetype.startsWith('video/')
    const folder: 'images' | 'videos' = isVideo ? 'videos' : 'images'

    // Upload to S3
    const { key, url } = await uploadToS3(
      file.buffer,
      file.originalname,
      folder
    )

    console.log(`✅ File uploaded to S3: ${file.originalname} by user ${auth?.userId || 'unknown'}`)
    console.log(`   S3 Key: ${key}`)
    console.log(`   S3 URL: ${url}`)
    console.log(`   Size: ${file.size} bytes`)
    console.log(`   Type: ${file.mimetype}`)

    res.json({
      success: true,
      data: {
        file_url: url,
        file_id: key, // Use S3 key as file_id
        file_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
      },
    })
  } catch (error) {
    console.error('❌ Error uploading file to S3:', error)
    if (error instanceof Error) {
      console.error('   Error message:', error.message)
      console.error('   Error stack:', error.stack)
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file'
    
    res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
})

export default router
