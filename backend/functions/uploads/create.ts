import { randomUUID } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  SCAN_UPLOAD_CONTENT_TYPES,
  SCAN_UPLOAD_MAX_BYTES,
  type UploadRequest,
  type UploadResponse,
} from '@cloudscribble/shared';
import { getAuthUser } from '../_shared/auth';
import { BadRequestError } from '../_shared/errors';
import { error, parseBody, success } from '../_shared/response';

const s3 = new S3Client({});
const EXPIRES_SECONDS = 300;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * POST /v1/uploads — presigned POST for one scan image.
 * S3 enforces size (content-length-range), content type, and the server-chosen key.
 */
export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  try {
    const user = getAuthUser(event);
    const { contentType } = parseBody<UploadRequest>(event.body);
    if (!SCAN_UPLOAD_CONTENT_TYPES.includes(contentType)) {
      throw new BadRequestError(`contentType must be one of: ${SCAN_UPLOAD_CONTENT_TYPES.join(', ')}`);
    }

    const uploadKey = `scans/${user.userId}/${randomUUID()}.${EXT[contentType]}`;
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: process.env.SCANS_BUCKET!,
      Key: uploadKey,
      Conditions: [
        ['content-length-range', 1, SCAN_UPLOAD_MAX_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: EXPIRES_SECONDS,
    });

    const body: UploadResponse = { url, fields, uploadKey, expiresInSeconds: EXPIRES_SECONDS };
    return success(body, 200, event);
  } catch (err) {
    return error(err, event);
  }
}
