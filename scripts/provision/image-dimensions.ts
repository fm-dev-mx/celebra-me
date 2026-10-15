/**
 * Node-only image dimension reader for the provisioning CLIs.
 *
 * `sharp` is a native module that does not exist on edge runtimes, so the server module
 * (`src/lib/intake/services/cloudinary-assets.ts`) never imports it; CLI callers pass this
 * reader in when they verify delivered bytes.
 */
import sharp from 'sharp';
import type { ImageDimensionReader } from '../../src/lib/intake/services/cloudinary-assets.ts';

export const readImageDimensions: ImageDimensionReader = async (bytes) => {
	const metadata = await sharp(Buffer.from(bytes)).metadata();
	return { width: metadata.width, height: metadata.height };
};
