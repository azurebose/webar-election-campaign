import { NextRequest, NextResponse } from 'next/server';
import { getPreSignedUploadUrl, getPublicAssetUrl } from '@/lib/r2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, contentType, email } = body;

    // Validate request parameters
    if (!filename || !contentType || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, contentType, and email are required.' },
        { status: 400 }
      );
    }

    // Verify authorized admin email strictly against environment variable
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      return NextResponse.json(
        { error: '403 Forbidden: Only the designated ADMIN_EMAIL is authorized to upload assets.' },
        { status: 403 }
      );
    }

    // Issue signed PutObjectCommand URL valid for 300 seconds to key posters/${filename}
    const uploadUrl = await getPreSignedUploadUrl(filename, contentType, 300);
    const publicUrl = getPublicAssetUrl(filename);
    const cleanFilename = filename.replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
    const key = cleanFilename.startsWith('posters/') ? cleanFilename : `posters/${cleanFilename}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
      expiresIn: 300,
    });
  } catch (error: any) {
    console.error('Error generating pre-signed upload URL:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error while generating pre-signed URL.' },
      { status: 500 }
    );
  }
}
