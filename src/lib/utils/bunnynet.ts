import crypto from "crypto";

// Bunny.net configuration
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY || process.env.BUNNY_API_KEY!;
const BUNNY_STREAM_API_KEY = process.env.BUNNY_API_KEY!;
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID || process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID!;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "simp2";
const BUNNY_STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || "uk";
// Use your configured CDN hostname, fallback to default pattern
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || `${BUNNY_STORAGE_ZONE}.b-cdn.net`;
const BUNNY_CDN_TOKEN_SECRET = process.env.BUNNY_CDN_TOKEN_SECRET!;

/**
 * Generate a signed URL for protected content access with PPV security
 * Includes message_id + user_id in signature for PPV content
 */
export function generateSignedUrl(
  path: string, 
  expiryMinutes: number = 60,
  messageId?: string,
  userId?: string
): string {
  const expires = Math.floor(Date.now() / 1000) + (expiryMinutes * 60);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Create hash for token authentication with PPV context
  let hashInput = `${BUNNY_CDN_TOKEN_SECRET}${cleanPath}${expires}`;
  if (messageId && userId) {
    hashInput += `${messageId}${userId}`;
  }
  
  const hash = crypto
    .createHash("sha256")
    .update(hashInput)
    .digest("hex");
  
  const baseUrl = `https://${BUNNY_CDN_HOSTNAME}${cleanPath}`;
  let signedUrl = `${baseUrl}?token=${hash}&expires=${expires}`;
  
  // Add PPV context to URL for additional security
  if (messageId && userId) {
    signedUrl += `&mid=${messageId}&uid=${userId}`;
  }
  
  return signedUrl;
}

/**
 * Upload profile picture to Bunny Storage
 */
export async function uploadProfilePicture(
  file: Buffer,
  userId: string,
  originalFileName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  // Reuse the existing uploadToBunnyStorage function for consistency
  const timestamp = Date.now();
  const extension = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${userId}-${timestamp}.${extension}`;
  
  return uploadToBunnyStorage(file, fileName, 'profile-pictures');
}

/**
 * Get profile picture URL for display (uses proxy for security)
 */
export function getProfilePictureUrl(
  path: string | null | undefined,
  options: {
    width?: number;
    height?: number;
    quality?: number;
  } = {}
): string {
  if (!path) {
    // Return a default avatar or placeholder
    return '/api/image/profile-pictures/default-avatar.jpg';
  }

  // Use the existing getBunnyStorageUrl for proxy access
  const baseUrl = getBunnyStorageUrl(path);
  
  // Add optimization parameters if provided
  if (Object.keys(options).length > 0) {
    const params = new URLSearchParams();
    if (options.width) params.set('width', options.width.toString());
    if (options.height) params.set('height', options.height.toString());
    if (options.quality) params.set('quality', options.quality.toString());
    
    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
  
  return baseUrl;
}

/**
 * Upload file to Bunny Storage (for PPV images)
 */
export async function uploadToBunnyStorage(
  file: Buffer,
  fileName: string,
  folder: string = "ppv-images"
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const uploadPath = `${folder}/${fileName}`;
    // Use storage API endpoint for uploads (not CDN)
    const uploadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${uploadPath}`;
    
    // Add timeout to prevent hanging uploads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: file as BodyInit,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const responseText = await response.text().catch(() => 'No response body');
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${responseText}`);
    }

    return {
      success: true,
      url: `/${uploadPath}`, // Store relative path for proxy access
    };
  } catch (error) {
    console.error('Bunny Storage upload error:', error);
    
    // Handle timeout specifically
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Upload timeout - please try again with a smaller file',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Upload video to Bunny Stream (for PPV videos)
 */
export async function uploadToBunnyStream(
  file: Buffer,
  title: string
): Promise<{ success: boolean; videoId?: string; error?: string }> {
  try {
    const headers = {
      'AccessKey': BUNNY_STREAM_API_KEY,
      'Content-Type': 'application/json',
    };

    // Create video entry
    const createResponse = await fetch(`https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Create video failed: ${createResponse.status} - ${errorText}`);
    }

    const videoData = await createResponse.json();
    const videoId = videoData.guid;

    // Upload video file
    const uploadResponse = await fetch(`https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STREAM_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: file as BodyInit,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Video upload failed: ${uploadResponse.status}`);
    }

    return {
      success: true,
      videoId,
    };
  } catch (error) {
    console.error('Bunny Stream upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Video upload failed',
    };
  }
}

/**
 * Get Bunny Stream embed URL
 */
export function getBunnyStreamEmbedUrl(videoId: string, isMobile: boolean = false): string {
  if (!videoId || !BUNNY_STREAM_LIBRARY_ID) {
    console.error('Missing required parameters for Bunny Stream embed');
    return '';
  }

  const baseUrl = `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY_ID}/${videoId}`;
  const embedUrl = `${baseUrl}?autoplay=false&loop=false&muted=true&playsinline=true`;
  
  return embedUrl;
}

/**
 * Get Bunny Stream direct play URL (for custom players)
 */
export function getBunnyStreamPlayUrl(videoId: string): string {
  const libraryId = BUNNY_STREAM_LIBRARY_ID;
  if (!libraryId) {
    console.error('BUNNY_STREAM_LIBRARY_ID is not set');
    return '';
  }
  
  const zoneId = libraryId.includes('-') 
    ? libraryId.split('-')[0] 
    : libraryId;
  return `https://vz-${zoneId}.b-cdn.net/${videoId}/playlist.m3u8`;
}

/**
 * Generate thumbnail URL for a video from Bunny.net Stream
 */
export function getVideoThumbnailUrl(
  videoId: string, 
  options: {
    width?: number;
    height?: number;
    time?: number;
    useProxy?: boolean;
  } = {}
): string {
  if (!BUNNY_STREAM_LIBRARY_ID) {
    console.error('BUNNY_STREAM_LIBRARY_ID is not set');
    return '';
  }
  
  const { width = 320, height = 180, time = 0, useProxy = false } = options;
  
  if (useProxy) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    return `${baseUrl}/api/thumbnail-proxy/${videoId}?width=${width}&height=${height}&time=${time}`;
  }
  
  const baseUrl = `https://vz-7465723a-98d.b-cdn.net/${videoId}/thumbnail.jpg`;
  
  if (Object.keys(options).length === 0) {
    return baseUrl;
  }
  
  return `${baseUrl}?width=${width}&height=${height}&time=${time}`;
}

/**
 * Generate optimized image URL with parameters (including blur for PPV previews)
 */
export function getOptimizedImageUrl(
  path: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
    blur?: number; // 0-100, for PPV preview images
    sharpen?: boolean;
  } = {}
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = `https://${BUNNY_CDN_HOSTNAME}${cleanPath}`;
  const params = new URLSearchParams();
  
  if (options.width) params.set('width', options.width.toString());
  if (options.height) params.set('height', options.height.toString());
  if (options.quality) params.set('quality', options.quality.toString());
  if (options.format) params.set('format', options.format);
  if (options.blur !== undefined) params.set('blur', options.blur.toString());
  if (options.sharpen) params.set('sharpen', 'true');
  
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Generate Bunny Storage URL via authenticated proxy API for PPV content
 */
export function getBunnyStorageUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    const trustedDomains = [
      'vz-7465723a-98d.b-cdn.net',
      `${BUNNY_CDN_HOSTNAME}`,
    ];
    
    const url = new URL(path);
    const isAllowedDomain = trustedDomains.some(domain => url.hostname === domain);
    
    if (!isAllowedDomain) {
      console.warn(`Blocked external URL in getBunnyStorageUrl: ${path}`);
      return '/placeholder-image.jpg';
    }
    
    return path;
  }
  
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `/api/image/${cleanPath}`;
}

/**
 * Validate that a URL is a valid Bunny Storage path for PPV content
 */
export function validateBunnyStorageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  if (url.startsWith('http://') || url.startsWith('https://') || url.includes('://')) {
    return false;
  }

  if (url.includes('..') || url.includes('\\') || url.includes('<') || url.includes('>')) {
    return false;
  }

  // Allow PPV content prefixes
  const allowedPrefixes = [
    '/ppv-images/',
    'ppv-images/',
    '/ppv-videos/',
    'ppv-videos/',
    '/profile-pictures/',
    'profile-pictures/',
    '/uploads/',
    'uploads/'
  ];

  const hasValidPrefix = allowedPrefixes.some(prefix => url.startsWith(prefix));
  if (!hasValidPrefix) {
    return false;
  }

  // Ensure valid file extension (or allow profile pictures without extensions)
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.avi'];
  const hasValidExtension = validExtensions.some(ext => 
    url.toLowerCase().endsWith(ext)
  );

  // Allow profile pictures without extensions (they may be generated/processed images)
  const isProfilePicture = url.startsWith('/profile-pictures/') || url.startsWith('profile-pictures/');
  
  return hasValidExtension || isProfilePicture;
}
