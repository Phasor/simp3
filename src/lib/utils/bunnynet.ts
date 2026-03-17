// Bunny.net configuration
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY || process.env.BUNNY_API_KEY;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "simp2";
const BUNNY_STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || "uk";
// Use your configured CDN hostname, fallback to default pattern
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || `${BUNNY_STORAGE_ZONE}.b-cdn.net`;

/**
 * Upload profile picture to Bunny Storage
 */
export async function uploadProfilePicture(
  file: Buffer,
  userId: string,
  originalFileName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
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
    return '/default-avatar.svg';
  }

  const baseUrl = getBunnyStorageUrl(path);

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
 * Get banner image URL for display (uses proxy for security)
 */
export function getBannerImageUrl(
  path: string | null | undefined,
  options: {
    width?: number;
    height?: number;
    quality?: number;
  } = {}
): string {
  if (!path) {
    return 'https://placehold.co/800x450?text=Exclusive+Content+Preview';
  }

  const baseUrl = getBunnyStorageUrl(path);

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
    if (!BUNNY_STORAGE_API_KEY) {
      console.error('❌ BUNNY_STORAGE_API_KEY is not configured');
      return {
        success: false,
        error: 'Bunny.net storage API key is not configured',
      };
    }

    const uploadPath = `${folder}/${fileName}`;
    const uploadUrl = `https://${BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${uploadPath}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
      console.error('❌ Upload failed response:', responseText);

      if (response.status === 401) {
        throw new Error('Authentication failed - please check your Bunny.net API key');
      } else if (response.status === 403) {
        throw new Error('Access denied - please check your Bunny.net permissions');
      } else if (response.status === 404) {
        throw new Error('Storage zone not found - please check your configuration');
      }

      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${responseText}`);
    }

    return {
      success: true,
      url: `/${uploadPath}`,
    };
  } catch (error) {
    console.error('Bunny Storage upload error:', error);

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
 * Generate Bunny Storage URL via authenticated proxy API for PPV content
 */
export function getBunnyStorageUrl(path: string): string {
  if (!path || typeof path !== 'string') {
    console.warn('Invalid path provided to getBunnyStorageUrl:', path);
    return '/placeholder-image.jpg';
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    const trustedDomains = [
      'vz-7465723a-98d.b-cdn.net',
      `${BUNNY_CDN_HOSTNAME}`,
      // Hardcoded storage hostname — BUNNY_CDN_HOSTNAME is not NEXT_PUBLIC so client sees wrong value
      'uk.storage.bunnycdn.com',
      'storage.bunnycdn.com',
    ];

    try {
      const url = new URL(path);
      const isAllowedDomain = trustedDomains.some(domain => url.hostname === domain);

      if (!isAllowedDomain) {
        console.warn(`Blocked external URL in getBunnyStorageUrl: ${path}`);
        return '/placeholder-image.jpg';
      }

      // Route through the proxy instead of returning the raw CDN URL directly
      // (CDN has token auth enabled — direct requests return 403)
      const relativePath = url.pathname.replace(/^\//, '');
      return `/api/image/${relativePath}`;
    } catch (error) {
      console.warn(`Invalid URL in getBunnyStorageUrl: ${path}`, error);
      return '/placeholder-image.jpg';
    }
  }

  let cleanPath = path.trim();

  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.substring(1);
  }

  const validPrefixes = ['profile-pictures/', 'banner-images/', 'ppv-images/', 'ppv-videos/', 'uploads/', 'wall-images/', 'wall-videos/', 'evidence/', 'task-covers/'];
  const hasValidPrefix = validPrefixes.some(prefix => cleanPath.startsWith(prefix));

  if (!hasValidPrefix) {
    console.warn(`Invalid path prefix in getBunnyStorageUrl: ${path}`);
    return '/placeholder-image.jpg';
  }

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

  const allowedPrefixes = [
    '/ppv-images/',
    'ppv-images/',
    '/ppv-videos/',
    'ppv-videos/',
    '/profile-pictures/',
    'profile-pictures/',
    '/banner-images/',
    'banner-images/',
    '/uploads/',
    'uploads/',
    '/wall-images/',
    'wall-images/',
    '/wall-videos/',
    'wall-videos/',
    '/task-covers/',
    'task-covers/',
    '/evidence/',
    'evidence/',
  ];

  const hasValidPrefix = allowedPrefixes.some(prefix => url.startsWith(prefix));
  if (!hasValidPrefix) {
    return false;
  }

  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.avi'];
  const hasValidExtension = validExtensions.some(ext =>
    url.toLowerCase().endsWith(ext)
  );

  const isProfilePicture = url.startsWith('/profile-pictures/') || url.startsWith('profile-pictures/');

  return hasValidExtension || isProfilePicture;
}
