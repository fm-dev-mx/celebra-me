import {
	resolveViewports,
	buildCurrentRunManifest,
	validateBlankBottom,
} from '../../../scripts/screenshot/utils';
import { resolveCapturePlan } from '../../../scripts/screenshot/capture';
import type { ScreenshotJob } from '../../../scripts/screenshot/types';

describe('Screenshot workflow sequence & capability contracts', () => {
	const mockPageWithEnvelope = {
		locator: (selector: string) => ({
			count: async () => {
				if (selector === '[data-screenshot="reveal-section"]') return 1;
				if (selector === '[data-screenshot="reveal-letter"]') return 1;
				if (selector === '[data-screenshot="reveal-trigger"]') return 1;
				return 0;
			},
			first: () => ({
				isVisible: async () => true,
			}),
		}),
		evaluate: async () => ({
			hasReveal: true,
			revealType: 'envelope' as const,
			hasLetter: true,
			hasFlapTransition: true,
		}),
	};

	const mockPageWithEditorialCover = {
		locator: (selector: string) => ({
			count: async () => {
				if (selector === '[data-screenshot="reveal-section"]') return 1;
				return 0;
			},
			first: () => ({
				isVisible: async () => true,
			}),
		}),
		evaluate: async () => ({
			hasReveal: true,
			revealType: 'editorial-cover' as const,
			hasLetter: false,
			hasFlapTransition: false,
		}),
	};

	const baseJob: ScreenshotJob = {
		pageType: 'invitation',
		mode: 'audit',
		url: 'http://localhost:4321/xv/abril-michelle-becerra-rea',
		baseUrl: 'http://localhost:4321',
		viewportProfile: 'invitation',
		viewports: resolveViewports('invitation', ['mobile-narrow']),
		target: 'critical-qa',
		revealHandling: 'auto',
		animationHandling: 'disable',
		sectionCapture: 'auto',
		sectionExtent: 'full',
		criticalSelectors: [],
		waitSelectors: [],
		hideSelectors: [],
		authMethod: 'none',
		outputFormat: 'png',
		outputFolderStyle: 'default',
	};

	it('plans all 5 reveal steps for standard envelope invitations (Abril Michelle / Boda Jewelry Box)', async () => {
		const tasks = await resolveCapturePlan(
			mockPageWithEnvelope as unknown as import('playwright').Page,
			baseJob,
		);
		expect(tasks.length).toBe(5);

		expect(tasks[0].id).toBe('01-initial-closed-viewport');
		expect(tasks[0].viewportOnly).toBe(true);
		expect(tasks[0].label).toContain('envelope');

		expect(tasks[1].id).toBe('02-reveal-closed');
		expect(tasks[2].id).toBe('03-reveal-letter-open');
		expect(tasks[3].id).toBe('04-reveal-transition-open');
		expect(tasks[4].id).toBe('05-invitation-full-page');
	});

	it('plans only valid cover and full-open tasks for editorial cover variants (skipping letter 03/04)', async () => {
		const tasks = await resolveCapturePlan(
			mockPageWithEditorialCover as unknown as import('playwright').Page,
			baseJob,
		);
		expect(tasks.length).toBe(3);

		expect(tasks[0].id).toBe('01-initial-closed-viewport');
		expect(tasks[0].viewportOnly).toBe(true);
		expect(tasks[0].label).toContain('cover');

		expect(tasks[1].id).toBe('02-reveal-closed');
		expect(tasks[2].id).toBe('05-invitation-full-page');

		// Unsupported letter steps must be excluded from planned count
		expect(tasks.some((t) => t.id === '03-reveal-letter-open')).toBe(false);
		expect(tasks.some((t) => t.id === '04-reveal-transition-open')).toBe(false);
	});

	it('correctly validates trailing blank space using layout evidence rather than solid background color', async () => {
		const validationWithContentEnd = await validateBlankBottom('dummy.png', {
			docHeight: 2000,
			lastContentBottom: 1980,
			trailingBlankPx: 20,
		});
		expect(validationWithContentEnd.trailingBlankSpaceDetected).toBe(false);

		const validationWithBlankTail = await validateBlankBottom('dummy.png', {
			docHeight: 2500,
			lastContentBottom: 2000,
			trailingBlankPx: 500,
		});
		expect(validationWithBlankTail.trailingBlankSpaceDetected).toBe(true);
	});

	it('plans optional reveal steps distinctly from required captures', async () => {
		const tasks = await resolveCapturePlan(
			mockPageWithEnvelope as unknown as import('playwright').Page,
			baseJob,
		);
		expect(tasks.find((t) => t.id === '02-reveal-closed')?.requirement).toBe('optional');
		expect(tasks.find((t) => t.id === '03-reveal-letter-open')?.requirement).toBe('optional');
		expect(tasks.find((t) => t.id === '04-reveal-transition-open')?.requirement).toBe(
			'optional',
		);
		expect(tasks.find((t) => t.id === '01-initial-closed-viewport')?.requirement).toBe(
			'required',
		);
		expect(tasks.find((t) => t.id === '05-invitation-full-page')?.requirement).toBe('required');
	});

	it('marks manifest status as failed when generated files are fewer than planned required tasks', () => {
		const [viewport] = resolveViewports('invitation', ['mobile-narrow']);
		const manifest = buildCurrentRunManifest({
			viewports: [viewport],
			perViewportPlanned: { 'mobile-narrow': 5 },
			target: 'critical-qa',
			captures: [
				{ path: 'a.png', viewportName: 'mobile-narrow', label: '01', success: true },
				{ path: 'b.png', viewportName: 'mobile-narrow', label: '02', success: true },
				{ path: 'c.png', viewportName: 'mobile-narrow', label: '03', success: true },
			],
		});

		expect(manifest[0].status).toBe('failed');
		expect(manifest[0].files).toBe(3);
		expect(manifest[0].expected).toBe(5);
	});

	it('does not fail when planned tasks include optional extras beyond required expected', () => {
		const [viewport] = resolveViewports('invitation', ['mobile-narrow']);
		const manifest = buildCurrentRunManifest({
			viewports: [viewport],
			perViewportPlanned: { 'mobile-narrow': 2 },
			target: 'critical-qa',
			perViewportPlannedTasks: {
				'mobile-narrow': [
					{ id: '01-initial-closed-viewport', required: true },
					{ id: '02-reveal-closed', required: false },
					{ id: '05-invitation-full-page', required: true },
				],
			},
			captures: [
				{
					id: '01-initial-closed-viewport',
					path: 'a.png',
					viewportName: 'mobile-narrow',
					label: '01',
					success: true,
				},
				{
					id: '02-reveal-closed',
					path: 'b.png',
					viewportName: 'mobile-narrow',
					label: '02',
					success: true,
					isOptional: true,
				},
				{
					id: '05-invitation-full-page',
					path: 'c.png',
					viewportName: 'mobile-narrow',
					label: '05',
					success: true,
				},
			],
		});

		expect(manifest[0].status).toBe('passed');
		expect(manifest[0].expected).toBe(2);
		expect(manifest[0].files).toBe(3);
		expect(manifest[0].plannedTotal).toBe(3);
	});

	let tempDir: string;
	let tempPngPath: string;

	beforeAll(async () => {
		const sharp = (await import('sharp')).default;
		const fs = await import('node:fs/promises');
		const os = await import('node:os');
		const path = await import('node:path');

		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'screenshot-seq-test-'));
		tempPngPath = path.join(tempDir, 'test-viewport.png');

		await sharp({
			create: {
				width: 780,
				height: 1688,
				channels: 4,
				background: { r: 255, g: 255, b: 255, alpha: 1 },
			},
		})
			.png()
			.toFile(tempPngPath);
	});

	afterAll(async () => {
		const fs = await import('node:fs/promises');
		if (tempDir) {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});

	it('detects FULL_PAGE_DIMENSION_MISMATCH when full-page PNG is viewport-sized on multi-viewport page', async () => {
		const { verifyPhysicalPng } = await import('../../../scripts/screenshot/utils');
		const check = await verifyPhysicalPng({
			filePath: tempPngPath,
			expectedCssWidth: 390,
			expectedCssHeight: 10000,
			viewportCssHeight: 844,
			deviceScaleFactor: 2,
		});

		expect(check.valid).toBe(false);
		expect(check.errorCode).toBe('FULL_PAGE_DIMENSION_MISMATCH');
	});

	it('detects SECTION_OUTSIDE_FULL_PAGE when section bounds exceed image height', async () => {
		const { verifySectionCropInclusion } = await import('../../../scripts/screenshot/utils');
		const check = await verifySectionCropInclusion({
			fullPagePath: tempPngPath,
			sectionId: 'thankYou',
			sectionBounds: { y: 2500, height: 500 },
			topY: 0,
			deviceScaleFactor: 2,
		});

		expect(check.valid).toBe(false);
		expect(check.errorCode).toBe('SECTION_OUTSIDE_FULL_PAGE');
	});
});
