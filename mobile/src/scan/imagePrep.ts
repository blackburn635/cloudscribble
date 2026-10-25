/**
 * Prepare a photo for scanning: downscale so the long edge is ~1568px (what Claude reads at
 * full detail) and re-encode as JPEG — this also converts iPhone HEIC, which Claude can't read.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const LONG_EDGE = 1568;

export interface PreparedImage {
  uri: string;
  width: number;
  height: number;
}

export async function prepareForScan(uri: string, width?: number, height?: number): Promise<PreparedImage> {
  const ctx = ImageManipulator.manipulate(uri);
  const landscape = (width ?? 0) > (height ?? 0);
  const needsResize = Math.max(width ?? Infinity, height ?? Infinity) > LONG_EDGE;
  if (needsResize) ctx.resize(landscape ? { width: LONG_EDGE } : { height: LONG_EDGE });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
