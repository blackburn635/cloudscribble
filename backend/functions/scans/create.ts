import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  SCAN_UPLOAD_CONTENT_TYPES,
  SCAN_UPLOAD_MAX_BYTES,
  type ScanRequest,
  type ScanResponse,
  type ScanUploadContentType,
} from '@cloudscribble/shared';
import { getAuthUser } from '../_shared/auth';
import { AppError, BadRequestError, SubscriptionRequiredError } from '../_shared/errors';
import { ensureProfile } from '../_shared/profile';
import { consumeScan, refundScan } from '../_shared/quota';
import { error, parseBody, success } from '../_shared/response';
import { hasScanAccess } from '../_shared/subscription';
import { scanPage, type ScanImage } from './ai';
import { isValidDate } from './validate';

const s3 = new S3Client({});
const BUCKET = process.env.SCANS_BUCKET!;

async function loadUpload(key: string): Promise<ScanImage> {
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const contentType = obj.ContentType as ScanUploadContentType;
    if (!SCAN_UPLOAD_CONTENT_TYPES.includes(contentType) || (obj.ContentLength ?? 0) > SCAN_UPLOAD_MAX_BYTES) {
      throw new AppError('Upload is not a supported image', 400, 'SCAN_UPLOAD_INVALID');
    }
    return { data: Buffer.from(await obj.Body!.transformToByteArray()), contentType };
  } catch (err) {
    if ((err as { name?: string }).name === 'NoSuchKey') {
      throw new AppError('Upload not found or expired — please retake the photo', 404, 'SCAN_UPLOAD_NOT_FOUND');
    }
    throw err;
  }
}

/**
 * POST /v1/scans — auth → access → upload → quota → AI → validated events.
 * The device writes the events to its calendar; nothing about the events is stored.
 */
export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  try {
    const user = getAuthUser(event);
    const { uploadKey, localDate } = parseBody<ScanRequest>(event.body);

    // The key must be one we issued to this user (scans/<sub>/<uuid>.<ext>).
    const keyPattern = new RegExp(`^scans/${user.userId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);
    if (typeof uploadKey !== 'string' || !keyPattern.test(uploadKey)) throw new BadRequestError('Invalid uploadKey');
    if (!isValidDate(localDate)) throw new BadRequestError('localDate must be YYYY-MM-DD');

    await ensureProfile(user);
    if (!(await hasScanAccess(user))) {
      throw new SubscriptionRequiredError('An active subscription is required to scan pages');
    }

    const image = await loadUpload(uploadKey);
    const remainingThisMonth = await consumeScan(user.userId);

    let scan;
    try {
      scan = await scanPage(image, localDate);
    } catch (err) {
      console.error('Scan AI error', err);
      await refundScan(user.userId);
      throw new AppError("We couldn't read that page right now. Please try again.", 502, 'SCAN_AI_ERROR');
    } finally {
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: uploadKey })).catch(() => undefined);
    }

    const { final, runs } = scan;
    console.log(JSON.stringify({
      msg: 'scan',
      user: user.userId,
      models: runs.map((r) => ({ model: r.model, confidence: r.result.confidence, events: r.result.events.length, usage: r.usage })),
    }));

    if (!final.result.readable) {
      throw new AppError(
        "That doesn't look like a readable planner page. Try a flatter, well-lit photo of a single page.",
        422,
        'SCAN_UNREADABLE'
      );
    }

    const body: ScanResponse = { ...final.result, model: final.model, remainingThisMonth };
    return success(body, 200, event);
  } catch (err) {
    return error(err, event);
  }
}
