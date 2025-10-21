# Bunny.net Configuration Guide

## Issue: Profile Picture Upload Failing with 401 Unauthorized

The profile picture upload is failing because Bunny.net is not properly configured. Here's how to fix it:

## Required Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
# Bunny.net Storage Configuration
BUNNY_STORAGE_API_KEY=your_storage_api_key_here
BUNNY_STORAGE_ZONE=your_storage_zone_name
BUNNY_STORAGE_REGION=uk

# Optional: If you have a custom CDN hostname
BUNNY_CDN_HOSTNAME=your-custom-domain.com

# For video streaming (if needed)
BUNNY_API_KEY=your_main_api_key
BUNNY_STREAM_LIBRARY_ID=your_stream_library_id

# For signed URLs (if using protected content)
BUNNY_CDN_TOKEN_SECRET=your_token_secret
```

## How to Get These Values

### 1. Bunny.net Storage Zone Setup

1. Log into your [Bunny.net dashboard](https://panel.bunnycdn.com/)
2. Go to **Storage** → **Storage Zones**
3. Create a new storage zone or use an existing one
4. Note the **Zone Name** (use this for `BUNNY_STORAGE_ZONE`)
5. Note the **Region** (use this for `BUNNY_STORAGE_REGION`)

### 2. API Key Setup

1. In Bunny.net dashboard, go to **Account** → **Account Settings**
2. Go to the **API** tab
3. Copy your **Storage API Key** (use this for `BUNNY_STORAGE_API_KEY`)
4. If you need the main API key, copy the **API Key** (use this for `BUNNY_API_KEY`)

### 3. Verify Configuration

Run the test script to verify your configuration:

```bash
node test-bunny-config.js
```

## Common Issues and Solutions

### 401 Unauthorized Error
- **Cause**: Missing or incorrect API key
- **Solution**: Double-check your `BUNNY_STORAGE_API_KEY` in `.env.local`

### 404 Not Found Error
- **Cause**: Incorrect storage zone name or region
- **Solution**: Verify `BUNNY_STORAGE_ZONE` and `BUNNY_STORAGE_REGION`

### 403 Forbidden Error
- **Cause**: API key doesn't have storage permissions
- **Solution**: Use the Storage API Key, not the main API key

### Upload Timeout
- **Cause**: Large file or slow connection
- **Solution**: Try with a smaller image file first

## Testing the Fix

1. Set up your environment variables
2. Restart your development server: `npm run dev`
3. Try creating a new creator account with a profile picture
4. Check the console logs for detailed debugging information

## File Structure

The upload system works as follows:

1. **Upload**: Files go to `https://{region}.storage.bunnycdn.com/{zone}/profile-pictures/`
2. **Access**: Files are served via `/api/image/profile-pictures/{filename}`
3. **Storage**: Relative paths are stored in the database as `/profile-pictures/{filename}`

## Security Notes

- Profile pictures are uploaded to the `profile-pictures/` folder
- Files are served through a proxy API for security
- Only authenticated users can upload profile pictures
- File types and sizes are validated before upload

## Need Help?

If you're still having issues:

1. Check the browser console for error messages
2. Check the server logs for detailed error information
3. Verify your Bunny.net account has sufficient credits
4. Ensure your storage zone is active and not suspended
