# AWS S3 Bucket Setup Guide for Rentany

This guide will help you configure your S3 bucket (`rentany-uploads`) to allow public access to images and videos.

## Step 1: Create the S3 Bucket

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click "Create bucket"
3. Bucket name: `rentany-uploads`
4. Choose your AWS region (e.g., `us-east-1`, `us-west-2`)
5. **Important**: Note the region you choose - you'll need to set `AWS_REGION` in your `.env` file

## Step 2: Configure Public Access

### Option A: If your bucket allows ACLs (older buckets)

1. Go to your bucket → **Permissions** tab
2. Under **Block public access**, click **Edit**
3. **Uncheck** all 4 boxes:
   - ☐ Block all public access
   - ☐ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ☐ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ☐ Block public access to buckets and objects granted through new public bucket or access point policies
4. Click **Save changes**
5. Confirm by typing `confirm`

### Option B: If your bucket has ACLs disabled (newer buckets - recommended)

1. Go to your bucket → **Permissions** tab
2. Under **Block public access**, keep it **enabled** (default)
3. Scroll down to **Bucket policy**
4. Click **Edit** and paste this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::rentany-uploads/*"
    }
  ]
}
```

5. Replace `rentany-uploads` with your actual bucket name if different
6. Click **Save changes**

## Step 3: Configure CORS (Required for Frontend Access)

1. Go to your bucket → **Permissions** tab
2. Scroll down to **Cross-origin resource sharing (CORS)**
3. Click **Edit** and paste this configuration:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-production-domain.com"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

4. **Important**: Replace `https://your-production-domain.com` with your actual production frontend URL
5. For local development, `http://localhost:3000` is already included
6. Click **Save changes**

## Step 4: Verify Your .env Configuration

Make sure your `backend/.env` file has:

```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1  # Must match your bucket's region!
AWS_S3_BUCKET_NAME=rentany-uploads
```

## Step 5: Test Image Access

1. Upload an image through your application
2. Copy the S3 URL from the response (e.g., `https://rentany-uploads.s3.us-east-1.amazonaws.com/images/1234567890-uuid.jpg`)
3. Open the URL directly in your browser
4. If you see the image, it's working! ✅
5. If you see an error (403 Forbidden, Access Denied), check:
   - Bucket policy is correct
   - CORS is configured
   - Region matches your `.env` file

## Troubleshooting

### Images still not loading?

1. **Check browser console** (F12 → Console tab):
   - Look for CORS errors
   - Look for 403/404 errors

2. **Test S3 URL directly**:
   - Copy an image URL from your database
   - Paste it in a new browser tab
   - If it loads: CORS issue
   - If it doesn't: Public access issue

3. **Verify bucket region**:
   - Go to S3 Console → Your bucket → Properties tab
   - Check "AWS Region"
   - Make sure it matches `AWS_REGION` in your `.env`

4. **Check IAM permissions**:
   - Your AWS user needs:
     - `s3:PutObject`
     - `s3:GetObject`
     - `s3:DeleteObject`
     - `s3:PutObjectAcl` (if using ACLs)

## Common Issues

### "Access Denied" when loading images
- **Solution**: Check bucket policy (Step 2, Option B)

### CORS error in browser console
- **Solution**: Configure CORS (Step 3) and make sure your frontend URL is in the `AllowedOrigins` list

### Images upload but URL returns 404
- **Solution**: Check that the region in `.env` matches your bucket's region

### "PermanentRedirect" error
- **Solution**: Your bucket is in a different region than `AWS_REGION` in `.env`. Update `AWS_REGION` to match your bucket.
