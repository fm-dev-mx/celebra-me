import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { rominaInvitation } from '../../scripts/provision/invitations/romina-rios-chaparro';
import { getInvitationAssetSourceDir } from '../../scripts/provision/invitations/invitation-definition';
import { normalizeInvitationImage, extractBlobRawBytes } from '@/lib/intake/services/asset-policy';
import { Blob as NodeBlob } from 'node:buffer';
const cases = [
	{
		key: 'hero-mobile',
		source: 'IMG_3263.jpeg',
		hash: '397bb6aa64fa4fd2f682a39914f723010cde5c69c16d2b24a563139f7e33c4f9',
		maxBytes: 358400,
		dimensions: [1280, 1920],
	},
	{
		key: 'social',
		source: 'IMG_3201.jpeg',
		hash: '226e5ff84a936e7596074a1cdf520f2ddf7d639305205fd23b614271ed6225b8',
		maxBytes: 184320,
		dimensions: [1280, 853],
	},
];
test.each(cases)(
	'$key preserves its original and publishes a budgeted derivative without re-encoding',
	async ({ key, source, hash, maxBytes, dimensions }) => {
		const spec = rominaInvitation.assets.find((asset) => asset.key === key)!;
		const root = getInvitationAssetSourceDir(rominaInvitation);
		expect(
			createHash('sha256')
				.update(fs.readFileSync(path.join(root, source)))
				.digest('hex'),
		).toBe(hash);
		const bytes = fs.readFileSync(path.join(root, spec.relativePath));
		const metadata = await sharp(bytes).metadata();
		expect([metadata.width, metadata.height]).toEqual(dimensions);
		expect(bytes.length).toBeLessThanOrEqual(maxBytes);
		expect(spec.sourcePolicy).toBe('preserve');
		expect(spec.delivery).toEqual({
			mode: 'original',
			width: dimensions[0],
			height: dimensions[1],
		});
		const normalized = await normalizeInvitationImage(
			new NodeBlob([bytes], { type: 'image/webp' }) as Blob,
			'image/webp',
			spec.optimizationRole,
			spec.sourcePolicy,
		);
		expect(Buffer.from((await extractBlobRawBytes(normalized.blob))!)).toEqual(bytes);
	},
);
