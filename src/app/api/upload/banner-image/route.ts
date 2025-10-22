import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadToBunnyStorage } from '@/lib/utils/bunnynet';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only creators can upload banner images
    if (profile.user_type !== 'CREATOR') {
      return NextResponse.json({ error: 'Only creators can upload banner images' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 10MB for banner images)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${profile.id}-${timestamp}.${extension}`;

    // Upload to Bunny CDN
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const uploadResult = await uploadToBunnyStorage(buffer, filename, 'banner-images');
    
    if (!uploadResult.success) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Update profile with new banner image URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ banner_image_url: filename })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      url: filename,
      message: 'Banner image uploaded successfully' 
    });

  } catch (error) {
    console.error('Banner upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
