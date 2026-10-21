import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'election-campaign-assets';
export const R2_PUBLIC_DOMAIN =
  process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'pub-2a862321b71a474f8dfa575716c82ab4.r2.dev';

/**
 * Cloudflare R2 S3-Compatible Client
 * Targeted at https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com with region 'auto'
 */
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Generate a pre-signed upload URL for administrative media ingestion
 * Valid for 300 seconds by default. Targets the `posters/${filename}` object key.
 */
export async function getPreSignedUploadUrl(
  filename: string,
  contentType: string,
  expiresIn: number = 300
): Promise<string> {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2_BUCKET_NAME environment variable is not defined.');
  }

  // Sanitize filename to prevent directory traversal or malformed keys
  const sanitizedFilename = filename.replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
  const key = sanitizedFilename.startsWith('posters/') ? sanitizedFilename : `posters/${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Resolve public CDN asset URL for zero-egress public campaign asset delivery.
 * E.g., targets.mind -> https://${NEXT_PUBLIC_R2_PUBLIC_DOMAIN}/posters/targets.mind
 */
export function getPublicAssetUrl(filenameOrKey: string): string {
  const sanitized = filenameOrKey.replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
  const key = sanitized.startsWith('posters/') ? sanitized : `posters/${sanitized}`;

  if (R2_PUBLIC_DOMAIN) {
    const domain = R2_PUBLIC_DOMAIN.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${domain}/${key}`;
  }

  // Fallback to local public path if R2 public domain is not configured
  return `/${sanitized.replace(/^posters\//, '')}`;
}
