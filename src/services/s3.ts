import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET_NAME } from '../config/env'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

// Initialize S3 client
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  } : undefined,
})

/**
 * Upload a file to S3
 * @param file - The file buffer or stream
 * @param originalName - Original filename for extension
 * @param folder - Optional folder path in S3 (e.g., 'images', 'videos')
 * @returns The S3 object key and public URL
 */
export async function uploadToS3(
  file: Buffer,
  originalName: string,
  folder: 'images' | 'videos' = 'images'
): Promise<{ key: string; url: string }> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials are not configured. Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to your .env file.')
  }

  if (!AWS_S3_BUCKET_NAME) {
    throw new Error('AWS S3 bucket name is not configured. Please add AWS_S3_BUCKET_NAME to your .env file.')
  }

  // Generate unique filename: timestamp-uuid-originalname
  const ext = path.extname(originalName)
  const uniqueName = `${Date.now()}-${uuidv4()}${ext}`
  const key = `${folder}/${uniqueName}`

  // Determine content type based on file extension
  const contentType = getContentType(ext, folder)

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    // Make files publicly readable
    // Note: If your bucket has ACLs disabled, configure bucket policy instead:
    // {
    //   "Version": "2012-10-17",
    //   "Statement": [{
    //     "Effect": "Allow",
    //     "Principal": "*",
    //     "Action": "s3:GetObject",
    //     "Resource": "arn:aws:s3:::rentany-uploads/*"
    //   }]
    // }
    ACL: 'public-read',
  })

  try {
    await s3Client.send(command)
  } catch (error: any) {
    // If ACL fails (bucket has ACLs disabled), retry without ACL
    if (error.name === 'AccessControlListNotSupported' || error.code === 'AccessControlListNotSupported') {
      console.warn('⚠️  S3 bucket has ACLs disabled, uploading without ACL. Ensure bucket policy allows public read access.')
      const commandWithoutACL = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET_NAME,
        Key: key,
        Body: file,
        ContentType: contentType,
      })
      await s3Client.send(commandWithoutACL)
    } else if (error.name === 'PermanentRedirect' || error.$metadata?.httpStatusCode === 301) {
      // Bucket is in a different region - try to extract the correct region
      const correctRegion = extractRegionFromError(error)
      
      if (correctRegion) {
        throw new Error(
          `S3 bucket "${AWS_S3_BUCKET_NAME}" is in region "${correctRegion}", but your AWS_REGION is set to "${AWS_REGION}". ` +
          `Please update AWS_REGION in your .env file to "${correctRegion}".`
        )
      } else {
        throw new Error(
          `S3 bucket "${AWS_S3_BUCKET_NAME}" is not in region "${AWS_REGION}". ` +
          `Please check your bucket's region in AWS Console (Properties tab) and update AWS_REGION in your .env file. ` +
          `Common regions: us-east-1, us-west-2, eu-west-1, ap-southeast-1, etc.`
        )
      }
    } else {
      // Provide more detailed error messages
      console.error('❌ S3 Upload Error:', {
        name: error.name,
        code: error.code,
        message: error.message,
        bucket: AWS_S3_BUCKET_NAME,
        region: AWS_REGION,
        key: key,
        metadata: error.$metadata,
      })
      
      // Create user-friendly error messages
      if (error.name === 'NoSuchBucket') {
        throw new Error(`S3 bucket "${AWS_S3_BUCKET_NAME}" does not exist. Please create it in AWS S3.`)
      } else if (error.name === 'InvalidAccessKeyId' || error.code === 'InvalidAccessKeyId') {
        throw new Error('Invalid AWS Access Key ID. Please check your AWS_ACCESS_KEY_ID in .env file.')
      } else if (error.name === 'SignatureDoesNotMatch' || error.code === 'SignatureDoesNotMatch') {
        throw new Error('Invalid AWS Secret Access Key. Please check your AWS_SECRET_ACCESS_KEY in .env file.')
      } else if (error.name === 'AccessDenied' || error.code === 'AccessDenied') {
        throw new Error(`Access denied to S3 bucket "${AWS_S3_BUCKET_NAME}". Check your AWS IAM permissions.`)
      } else if (error.name === 'NetworkingError' || error.code === 'NetworkingError') {
        throw new Error(`Network error connecting to AWS S3. Check your internet connection and AWS region (${AWS_REGION}).`)
      } else {
        throw new Error(`S3 upload failed: ${error.message || error.name || 'Unknown error'}`)
      }
    }
  }

  // Construct public URL
  const url = `https://${AWS_S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`

  return { key, url }
}

/**
 * Delete a file from S3
 * @param key - The S3 object key
 */
export async function deleteFromS3(key: string): Promise<void> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials are not configured')
  }

  const command = new DeleteObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * Get a presigned URL for private file access (if needed in future)
 * @param key - The S3 object key
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned URL
 */
export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error('AWS credentials are not configured')
  }

  const command = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Extract region from error response (if available)
 */
function extractRegionFromError(error: any): string | null {
  // Try to extract region from error response headers
  if (error.$response?.headers?.['x-amz-bucket-region']) {
    return error.$response.headers['x-amz-bucket-region']
  }
  
  // Check if error message contains region info
  const regionMatch = error.message?.match(/region[:\s]+([a-z0-9-]+)/i)
  if (regionMatch) {
    return regionMatch[1]
  }
  
  return null
}

/**
 * Determine content type based on file extension
 */
function getContentType(ext: string, folder: 'images' | 'videos'): string {
  const extLower = ext.toLowerCase()

  if (folder === 'images') {
    const imageTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }
    return imageTypes[extLower] || 'image/jpeg'
  } else {
    const videoTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.mpeg': 'video/mpeg',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
    }
    return videoTypes[extLower] || 'video/mp4'
  }
}
