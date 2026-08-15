import { describe, expect, it } from '@jest/globals';
import {
	selectEnforcedApprovalAssetPaths,
	selectPackageApprovalAssetHashes,
} from '../../scripts/provision/approval-asset-hashes.ts';

describe('selectPackageApprovalAssetHashes', () => {
	it('keeps package storagePath hashes and drops leftover Cloudinary public IDs', () => {
		expect(
			selectPackageApprovalAssetHashes(
				{
					'managed/renata/hero-desktop.webp': 'a'.repeat(64),
					'managed/renata/hero-mobile.webp': 'b'.repeat(64),
					'xv/renata/assets/hero-desktop-34522c50d513': 'c'.repeat(64),
					'xv/renata/assets/hero-mobile-34522c50d513': 'd'.repeat(64),
				},
				[
					{ storagePath: 'managed/renata/hero-desktop.webp' },
					{ storagePath: 'managed/renata/hero-mobile.webp' },
				],
			),
		).toEqual({
			'managed/renata/hero-desktop.webp': 'a'.repeat(64),
			'managed/renata/hero-mobile.webp': 'b'.repeat(64),
		});
	});
});

describe('selectEnforcedApprovalAssetPaths', () => {
	it('enforces verified paths and managed/ package paths, not leftover public IDs', () => {
		expect(
			selectEnforcedApprovalAssetPaths(
				{
					'managed/renata/hero.webp': 'a'.repeat(64),
					'xv/renata/assets/interlude-6f1f940883a7': 'b'.repeat(64),
				},
				{ 'managed/renata/hero.webp': 'a'.repeat(64) },
			),
		).toEqual(['managed/renata/hero.webp']);
	});
});
