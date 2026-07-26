import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
	invalidateStaleInvitationFullPage,
	removeLegacyInvitationFullOpenArtifacts,
	verifySectionCropInclusion,
} from '../../../scripts/screenshot/artifact-validation';

async function writeSolidPng(
	filePath: string,
	width: number,
	height: number,
	color: { r: number; g: number; b: number },
): Promise<void> {
	await sharp({
		create: {
			width,
			height,
			channels: 3,
			background: color,
		},
	})
		.png()
		.toFile(filePath);
}

describe('screenshot artifact validation freshness', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(path.join(tmpdir(), 'celebra-screenshot-artifact-'));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it('invalidates a previously published invitation full-page on failure paths', async () => {
		const finalPath = path.join(tempDir, 'mobile-standard', '05-invitation-full-page.png');
		mkdirSync(path.dirname(finalPath), { recursive: true });
		writeFileSync(finalPath, 'stale');

		const removed = await invalidateStaleInvitationFullPage(finalPath);
		expect(removed).toBe(true);
		expect(existsSync(finalPath)).toBe(false);
	});

	it('removes legacy 05-invitation-full-open artifacts from viewport folders', async () => {
		const viewportDir = path.join(tempDir, 'mobile-standard');
		mkdirSync(viewportDir, { recursive: true });
		const legacy = path.join(viewportDir, '05-invitation-full-open.png');
		const canonical = path.join(viewportDir, '05-invitation-full-page.png');
		writeFileSync(legacy, 'legacy');
		writeFileSync(canonical, 'canonical');

		const removed = await removeLegacyInvitationFullOpenArtifacts(tempDir);
		expect(removed).toEqual([legacy]);
		expect(existsSync(legacy)).toBe(false);
		expect(existsSync(canonical)).toBe(true);
	});

	it('treats standalone height skew as a warning when the crop is non-blank', async () => {
		const fullPagePath = path.join(tempDir, 'full.png');
		const standalonePath = path.join(tempDir, 'hero.png');
		// Full-page: 200x400 CSS @2x => 400x800 px; hero region 200 CSS tall => 400 px
		await writeSolidPng(fullPagePath, 400, 800, { r: 40, g: 80, b: 120 });
		// Standalone shorter than crop (would previously fail hard)
		await writeSolidPng(standalonePath, 400, 300, { r: 40, g: 80, b: 120 });

		const result = await verifySectionCropInclusion({
			fullPagePath,
			sectionId: 'interlude-1',
			sectionBounds: { y: 0, height: 200 },
			topY: 0,
			deviceScaleFactor: 2,
			standalonePath,
		});

		expect(result.valid).toBe(true);
		expect(result.warning).toMatch(/crop height/);
	});

	it('fails hero verification when the full-page strip does not match the standalone hero', async () => {
		const fullPagePath = path.join(tempDir, 'full.png');
		const standalonePath = path.join(tempDir, 'hero.png');
		await writeSolidPng(fullPagePath, 400, 800, { r: 200, g: 20, b: 20 });
		await writeSolidPng(standalonePath, 400, 400, { r: 20, g: 200, b: 20 });

		const result = await verifySectionCropInclusion({
			fullPagePath,
			sectionId: 'hero',
			sectionBounds: { y: 0, height: 200 },
			topY: 0,
			deviceScaleFactor: 2,
			standalonePath,
		});

		expect(result.valid).toBe(false);
		expect(result.errorCode).toBe('SECTION_CAPTURE_MISMATCH');
		expect(result.error).toMatch(/does not match standalone hero/);
	});

	it('passes hero verification when the full-page strip matches the standalone hero', async () => {
		const fullPagePath = path.join(tempDir, 'full.png');
		const standalonePath = path.join(tempDir, 'hero.png');
		await writeSolidPng(fullPagePath, 400, 800, { r: 90, g: 110, b: 130 });
		await writeSolidPng(standalonePath, 400, 400, { r: 90, g: 110, b: 130 });

		const result = await verifySectionCropInclusion({
			fullPagePath,
			sectionId: 'hero',
			sectionBounds: { y: 0, height: 200 },
			topY: 0,
			deviceScaleFactor: 2,
			standalonePath,
		});

		expect(result.valid).toBe(true);
	});
});
