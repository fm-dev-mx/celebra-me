import { describe, expect, it } from '@jest/globals';
import {
	getWeightTargetBytes,
	type ImageOptimizationRole,
} from '@/lib/invitation-preparation/image-optimization';
import { LESLIE_ASSET_SPECS } from '../../scripts/provision/invitations/leslie-perez.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';
import { invitationMediaEntries } from '../helpers/invitation-media';

// Delivery assets are the processed WebP derivatives under delivery/; raw source
// assets (venue photos, SVGs) are excluded from the budget contract until processed.
const DELIVERY_SPECS = LESLIE_ASSET_SPECS.filter((spec) =>
	spec.relativePath.startsWith('delivery/'),
);

describe('Leslie delivery image budgets', () => {
	it('keeps each declared delivery asset within its canonical role budget', () => {
		const entries = invitationMediaEntries(getInvitationDefinition('leslie-perez'))!;
		expect(DELIVERY_SPECS).toHaveLength(16);
		expect(new Set(DELIVERY_SPECS.map((spec) => spec.relativePath)).size).toBe(16);
		expect(DELIVERY_SPECS.some((spec) => spec.key === 'photo-01-mobile')).toBe(true);

		for (const spec of DELIVERY_SPECS) {
			const role = spec.optimizationRole as ImageOptimizationRole | undefined;
			expect(role).toBeDefined();
			// Size of the prepared delivery file; dimensions as published.
			const metadata = entries.get(spec.key)!;
			const maxBytes = getWeightTargetBytes(role!);
			expect(metadata.originalFileSize).toBeLessThanOrEqual(maxBytes);
			expect(metadata.width).toBeGreaterThanOrEqual(480);
			expect(metadata.height).toBeGreaterThanOrEqual(480);
			expect(metadata.width).toBeLessThanOrEqual(2560);
			expect(metadata.height).toBeLessThanOrEqual(2560);
		}
	});
});
