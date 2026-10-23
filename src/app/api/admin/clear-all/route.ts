import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || !email || email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      return NextResponse.json(
        { error: '403 Forbidden: Only the designated ADMIN_EMAIL is authorized to wipe assets.' },
        { status: 403 }
      );
    }

    if (!R2_BUCKET_NAME) {
      return NextResponse.json({ error: 'R2_BUCKET_NAME not defined.' }, { status: 500 });
    }

    // List all objects in posters/ prefix
    const listRes = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: 'posters/',
      })
    );

    let deletedCount = 0;
    if (listRes.Contents && listRes.Contents.length > 0) {
      const objectsToDelete = listRes.Contents.map((obj) => ({ Key: obj.Key }));
      await r2Client.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME,
          Delete: { Objects: objectsToDelete },
        })
      );
      deletedCount = objectsToDelete.length;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} poster asset(s) from Cloudflare R2 bucket.`,
      deletedCount,
    });
  } catch (error: any) {
    console.error('Error clearing R2 bucket assets:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error while clearing R2 assets.' },
      { status: 500 }
    );
  }
}
