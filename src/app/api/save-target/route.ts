import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const mindFile = formData.get('mind') as File | null;
    const videoFile = formData.get('video') as File | null;

    const publicDir = path.join(process.cwd(), 'public');

    // 1. Save compiled targets.mind
    if (mindFile) {
      const buffer = Buffer.from(await mindFile.arrayBuffer());
      fs.writeFileSync(path.join(publicDir, 'targets.mind'), buffer);
    }

    // 2. Save preview poster image
    if (imageFile) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      fs.writeFileSync(path.join(publicDir, 'sample_marker.png'), buffer);
    }

    // 3. Save optional video asset if supplied
    if (videoFile) {
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      fs.writeFileSync(path.join(publicDir, 'campaign_speech.mp4'), buffer);
    }

    return NextResponse.json({
      success: true,
      message: 'Target and media assets updated successfully.',
      timestamp: Date.now()
    });
  } catch (err: any) {
    console.error('Error saving target assets:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to save target assets' },
      { status: 500 }
    );
  }
}
