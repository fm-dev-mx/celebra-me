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

describe('Leslie delivery image budgets', () => {
	it('keeps each declared delivery asset within its canonical role budget', async () => {
		expect(LESLIE_ASSET_SPECS).toHaveLength(15);
		expect(new Set(LESLIE_ASSET_SPECS.map((spec) => spec.relativePath)).size).toBe(15);

		for (const spec of LESLIE_ASSET_SPECS) {
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
