import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { validateBunnyStorageUrl } from '@/lib/utils/bunnynet';

// Bunny.net configuration
const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "simp2";
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || "uk.storage.bunnycdn.com";

/**
 * Proxy API for serving images from Bunny.net Storage
 * This handles authentication and provides a secure way to serve profile pictures
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    
    // Validate the path for security
    if (!validateBunnyStorageUrl(path)) {
      console.warn('Invalid Bunny Storage URL attempted:', path);
      return new NextResponse('Invalid path', { status: 400 });
    }

    console.log('🖼️ Fetching image from Bunny Storage:', path);

    // Construct the Bunny Storage URL using your configured hostname
    const bunnyUrl = `https://${BUNNY_CDN_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`;
    console.log('🔗 Constructed Bunny URL:', bunnyUrl);

    // Fetch the image from Bunny Storage
    const response = await fetch(bunnyUrl, {
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY || '',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch from Bunny Storage:', response.status, response.statusText);
      
      // Return a placeholder or 404 for missing images
      if (response.status === 404) {
        return new NextResponse('Image not found', { status: 404 });
      }
      
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    // Get the image data
    let imageBuffer = Buffer.from(await response.arrayBuffer())

    // Apply server-side blur if requested (?blur=1-100)
    const blurParam = request.nextUrl.searchParams.get('blur')
    const blurSigma = blurParam ? Math.min(100, Math.max(1, parseInt(blurParam, 10))) : 0
    if (blurSigma > 0) {
      // Sharp sigma: 0.3–1000. Map blur 1-100 → sigma 1-50 for visible range
      const sigma = Math.round(blurSigma * 0.5)
      imageBuffer = await sharp(imageBuffer).blur(sigma).jpeg({ quality: 70 }).toBuffer()
    }

    // Determine content type from the original response or file extension
    const contentType = blurSigma > 0 ? 'image/jpeg' : (response.headers.get('content-type') || getContentTypeFromPath(path));

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

/**
 * Determine content type from file extension
 */
function getContentTypeFromPath(path: string): string {
  const extension = path.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg'; // Default fallback
  }
}
