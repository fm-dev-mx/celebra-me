import { describe, expect, it } from '@jest/globals';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import {
	getWeightTargetBytes,
	type ImageOptimizationRole,
} from '@/lib/invitation-preparation/image-optimization';
import { LESLIE_ASSET_SPECS } from '../../scripts/provision/invitations/leslie-perez.ts';

const ASSET_DIR = join(process.cwd(), 'src/assets/invitations/leslie-perez');

// Delivery assets are the processed WebP derivatives under delivery/; raw source
// assets (venue photos, SVGs) are excluded from the budget contract until processed.
const DELIVERY_SPECS = LESLIE_ASSET_SPECS.filter((spec) =>
	spec.relativePath.startsWith('delivery/'),
);

describe('Leslie delivery image budgets', () => {
	it('keeps each declared delivery asset within its canonical role budget', async () => {
		expect(DELIVERY_SPECS).toHaveLength(16);
		expect(new Set(DELIVERY_SPECS.map((spec) => spec.relativePath)).size).toBe(16);
		expect(DELIVERY_SPECS.some((spec) => spec.key === 'photo-01-mobile')).toBe(true);

		for (const spec of DELIVERY_SPECS) {
			const role = spec.optimizationRole as ImageOptimizationRole | undefined;
			expect(role).toBeDefined();
			const filePath = join(ASSET_DIR, spec.relativePath);
			expect(existsSync(filePath)).toBe(true);

			const metadata = await sharp(filePath).metadata();
			const maxBytes = getWeightTargetBytes(role!);
			expect(statSync(filePath).size).toBeLessThanOrEqual(maxBytes);
			expect(metadata.width).toBeGreaterThanOrEqual(480);
			expect(metadata.height).toBeGreaterThanOrEqual(480);
			expect(metadata.width).toBeLessThanOrEqual(2560);
			expect(metadata.height).toBeLessThanOrEqual(2560);
		}
	});
});
