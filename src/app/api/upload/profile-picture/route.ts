import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { uploadProfilePicture } from '@/lib/utils/bunnynet';

// Force Node runtime for Buffer support
export const runtime = 'nodejs';
// Prevent caching of upload routes
export const dynamic = 'force-dynamic';

async function supabaseFromCookies() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        // no-ops are fine since we don't need to set cookies in this route
        set: () => {},
        remove: () => {},
      },
    }
  );
}

// Timeout wrapper for Bunny upload
const withUploadTimeout = async <T>(promise: Promise<T>, timeoutMs = 15000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Upload timeout')), timeoutMs)
    )
  ]);
};

export async function POST(request: NextRequest) {
  console.log('🚀 Profile picture upload API called');
  
  try {
    // 1) Auth from request cookies
    console.log('🔍 Checking authentication...');
    const supabase = await supabaseFromCookies();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ User authenticated:', user.id);

    // Check Bunny.net configuration early
    const bunnyApiKey = process.env.BUNNY_STORAGE_API_KEY || process.env.BUNNY_API_KEY;
    if (!bunnyApiKey) {
      console.error('❌ Bunny.net API key not configured');
      return NextResponse.json({ 
        error: 'Storage service not configured. Please contact support.' 
      }, { status: 500 });
    }
    console.log('✅ Bunny.net API key configured');

    // 2) Parse form data
    console.log('📋 Parsing form data...');
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      console.error('❌ No file provided in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    console.log('📁 File received:', file.name, 'Type:', file.type, 'Size:', file.size);

    // 3) Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('❌ Invalid file type:', file.type);
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.error('❌ File too large:', file.size, 'bytes');
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    // 4) Convert to Buffer (Node runtime guaranteed)
    console.log('🔄 Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('✅ Buffer created, size:', buffer.length, 'bytes');

    // 5) Upload to Bunny with timeout
    console.log('☁️ Uploading to Bunny.net with 15s timeout...');
    const uploadResult = await withUploadTimeout(
      uploadProfilePicture(buffer, user.id, file.name),
      15000
    );

    if (!uploadResult.success) {
      console.error('❌ Bunny.net upload failed:', uploadResult.error);
      return NextResponse.json({ error: uploadResult.error || 'Upload failed' }, { status: 500 });
    }

    console.log('✅ Upload successful:', uploadResult.url);
    return NextResponse.json({ success: true, url: uploadResult.url });

  } catch (error) {
    console.error('💥 Profile picture upload API error:', error);
    
    // Handle timeout specifically
    if (error instanceof Error && error.message === 'Upload timeout') {
      return NextResponse.json({ error: 'Upload timeout - please try again' }, { status: 504 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}