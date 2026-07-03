// =============================================================================
// CELEBRA-ME | Screenshot Tool — Interactive CLI Flow
// =============================================================================

import { input, select } from '@inquirer/prompts';
import {
	type PageType,
	type ViewportProfileType,
	type InvitationSet,
	type GeneralSet,
	type RevealHandling,
	type SectionCapture,
	type AuthMethod,
	type OutputFormat,
	type OutputFolderStyle,
	type ScreenshotJob,
	type Viewport,
	type ScreenshotMode,
	DEFAULT_BASE_URL,
} from './types.js';
import {
	resolveUrl,
	createPageSlug,
	getDefaultProfile,
	resolveViewports,
	formatViewport,
	getDefaultCriticalSelectors,
	getViewportProfileSummary,
} from './utils.js';

// =============================================================================
// Interactive CLI Entry
// =============================================================================

/**
 * Ask the user to select a viewport profile and resolve viewport list.
 */
async function askViewportProfile(
	defaultProfile: 'invitation' | 'site',
): Promise<{ viewportProfile: ViewportProfileType; viewports: Viewport[] }> {
	const choice = await select<string>({
		message: 'Which viewport profile do you want?',
		choices: [
			{
				name: `Invitation  (${getViewportProfileSummary('invitation')})`,
				value: 'invitation',
			},
			{ name: `Site        (${getViewportProfileSummary('site')})`, value: 'site' },
			{ name: `Full        (${getViewportProfileSummary('full')})`, value: 'full' },
			{ name: 'Single viewport (pick one)', value: 'single' },
		],
		default: defaultProfile,
	});

	if (choice === 'single') {
		const vpName = await select<string>({
			message: 'Which viewport?',
			choices: [
				{ name: 'mobile-narrow   (360×740, @2x)', value: 'mobile-narrow' },
				{ name: 'mobile-standard (390×844, @2x)', value: 'mobile-standard' },
				{ name: 'mobile-large    (430×932, @3x)', value: 'mobile-large' },
				{ name: 'tablet          (768×1024, @2x)', value: 'tablet' },
				{ name: 'desktop         (1440×1200, @1x)', value: 'desktop' },
			],
			default: defaultProfile === 'invitation' ? 'mobile-standard' : 'desktop',
		});
		return { viewportProfile: 'single', viewports: resolveViewports('site', [vpName]) };
	}

	return {
		viewportProfile: choice as ViewportProfileType,
		viewports: resolveViewports(choice as ViewportProfileType),
	};
}

/**
 * Ask the user about individual section capture.
 */
async function askSectionCapture(
	pageType: PageType,
): Promise<{ sectionCapture: SectionCapture; sectionSelectors?: string[] }> {
	if (pageType !== 'invitation' && pageType !== 'landing' && pageType !== 'custom') {
		return { sectionCapture: 'none' };
	}

	const sectionCapture = await select<SectionCapture>({
		message:
			'Capture optional configured sections? Audit mode may still generate critical validation captures automatically.',
		choices: [
			{ name: 'No, skip optional sections', value: 'none' },
			{ name: 'Yes, auto-detect sections', value: 'auto' },
			...(pageType === 'invitation'
				? [{ name: 'Yes, known invitation sections', value: 'known' as SectionCapture }]
				: []),
			{ name: 'Yes, custom selectors', value: 'custom' },
		],
		default: 'none',
	});

	if (sectionCapture === 'custom') {
		const raw = await input({
			message: 'Enter CSS selectors (comma-separated):',
			default: '[data-screenshot-section="gallery"], #countdown, #rsvp',
		});
		return {
			sectionCapture,
			sectionSelectors: raw
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		};
	}

	return { sectionCapture };
}

/**
 * Run the interactive CLI flow: ask questions, show summary, confirm.
 * Returns a ScreenshotJob configuration, or null if the user cancels.
 */
export async function runInteractiveFlow(): Promise<ScreenshotJob | null> {
	console.log('\n📸  Celebra-me Screenshot Tool\n');

	// ── 1. Page Type ───────────────────────────────────────────────────────
	const pageType = await select<PageType>({
		message: 'What do you want to screenshot?',
		choices: [
			{
				name: 'Invitation page   (e.g. /boda/demo-boda-jewelry-box-wedding)',
				value: 'invitation',
			},
			{
				name: 'Landing page      (e.g. /)',
				value: 'landing',
			},
			{
				name: 'Dashboard / Admin (e.g. /dashboard)',
				value: 'dashboard',
			},
			{
				name: 'Login page        (e.g. /login)',
				value: 'login',
			},
			{
				name: 'Custom page       (e.g. /pricing)',
				value: 'custom',
			},
		],
		default: 'invitation',
	});

	// ── 2. URL / Route ─────────────────────────────────────────────────────
	const defaultRoute =
		pageType === 'invitation'
			? '/boda/demo-boda-jewelry-box-wedding'
			: pageType === 'landing'
				? '/'
				: pageType === 'dashboard'
					? '/dashboard'
					: pageType === 'login'
						? '/login'
						: '/pricing';

	const urlInput = await input({
		message: 'URL or route to capture:',
		default: defaultRoute,
		validate: (value) => (value.trim().length > 0 ? true : 'Route cannot be empty'),
	});

	// Check if full URL or local route
	const isFullUrl = /^https?:\/\//i.test(urlInput.trim());
	let baseUrl = DEFAULT_BASE_URL;

	if (!isFullUrl) {
		baseUrl = await input({
			message: 'Base URL:',
			default: DEFAULT_BASE_URL,
		});
	} else {
		// Extract base URL from the entered full URL
		try {
			const parsed = new URL(urlInput.trim());
			baseUrl = `${parsed.protocol}//${parsed.host}`;
		} catch {
			/* keep default */
		}
	}

	const resolvedUrl = resolveUrl(urlInput, baseUrl);

	// ── 3. Screenshot Set ──────────────────────────────────────────────────
	let invitationSet: InvitationSet | undefined;
	let generalSet: GeneralSet | undefined;

	if (pageType === 'invitation') {
		invitationSet = await select<InvitationSet>({
			message: 'Which screenshot set do you want?',
			choices: [
				{
					name: 'Essential invitation set  (initial page + reveal open/closed + full open)',
					value: 'essential',
				},
				{
					name: 'Full invitation QA       (essential + individual sections)',
					value: 'full-qa',
				},
				{
					name: 'Reveal only             (closed + open letter + open section)',
					value: 'reveal-only',
				},
				{
					name: 'Full page only',
					value: 'full-page',
				},
			],
			default: 'essential',
		});
	} else {
		generalSet = await select<GeneralSet>({
			message: 'Which screenshot set do you want?',
			choices: [
				{
					name: 'Basic page set        (viewport + full-page)',
					value: 'basic',
				},
				{
					name: 'Full page QA          (viewport + full-page + header + footer + sections)',
					value: 'full-qa',
				},
			],
			default: 'basic',
		});
	}

	// ── 4. Viewport Profile ────────────────────────────────────────────────
	const defaultProfile = getDefaultProfile(pageType);
	const { viewportProfile, viewports } = await askViewportProfile(defaultProfile);

	// ── 5. Reveal Handling (invitation only) ───────────────────────────────
	let revealHandling: RevealHandling = 'auto';

	if (pageType === 'invitation') {
		revealHandling = await select<RevealHandling>({
			message: 'How should reveal sections be handled?',
			choices: [
				{ name: 'Auto-detect reveal section', value: 'auto' },
				{ name: 'Force reveal open (query params)', value: 'force-open' },
				{ name: 'Capture closed state only', value: 'closed-only' },
				{ name: 'Capture open state only', value: 'open-only' },
				{ name: 'Skip reveal screenshots', value: 'skip' },
			],
			default: 'auto',
		});
	}

	// ── 6. Screenshot Mode ─────────────────────────────────────────────────
	const mode = await select<ScreenshotMode>({
		message: 'Screenshot mode?',
		choices: [
			{ name: 'Audit (stable visual QA)', value: 'audit' },
			{ name: 'Raw (minimal intervention)', value: 'raw' },
		],
		default: 'audit',
	});

	// ── 7. Section Capture ─────────────────────────────────────────────────
	const { sectionCapture, sectionSelectors } = await askSectionCapture(pageType);

	// ── 8. Authentication ─────────────────────────────────────────────────
	let authMethod: AuthMethod = 'none';

	if (
		pageType === 'dashboard' ||
		pageType === 'admin' ||
		pageType === 'login' ||
		pageType === 'custom'
	) {
		const isDashboard = pageType === 'dashboard' || pageType === 'admin';
		authMethod = await select<AuthMethod>({
			message: 'Does this page require authentication?',
			choices: [
				{ name: 'No', value: 'none' },
				{ name: 'Use existing browser session', value: 'existing-session' },
				{ name: 'Use saved Playwright storage state', value: 'storage-state' },
				{ name: 'Open browser for manual login', value: 'manual-login' },
			],
			default: isDashboard ? 'storage-state' : 'none',
		});
	}

	// ── 9. Output Format ───────────────────────────────────────────────────
	const outputFormat = await select<OutputFormat>({
		message: 'Output format?',
		choices: [
			{ name: 'PNG  (lossless, large)', value: 'png' },
			{ name: 'JPEG (smaller, configurable quality)', value: 'jpeg' },
			{ name: 'WebP (modern, smaller)', value: 'webp' },
			{ name: 'PDF  (full-page vector)', value: 'pdf' },
		],
		default: 'png',
	});

	// ── 10. Output Folder ──────────────────────────────────────────────────
	const outputStyle = await select<OutputFolderStyle>({
		message: 'Output folder style?',
		choices: [
			{ name: 'Default: screenshots/{page-slug}/{viewport}/', value: 'default' },
			{
				name: 'Timestamped: screenshots/{page-slug}/{YYYY-MM-DD-HHmm}/{viewport}/',
				value: 'timestamped',
			},
			{ name: 'Custom folder', value: 'custom' },
			{ name: 'Overwrite existing screenshots', value: 'overwrite' },
		],
		default: 'default',
	});

	let customOutput: string | undefined;
	if (outputStyle === 'custom') {
		customOutput = await input({
			message: 'Output folder path:',
			default: 'screenshots/my-capture',
		});
	}

	// ── Assemble Job ───────────────────────────────────────────────────────

	const job: ScreenshotJob = {
		pageType,
		mode,
		url: resolvedUrl,
		baseUrl,
		viewportProfile,
		viewports,
		invitationSet,
		generalSet,
		revealHandling,
		animationHandling: mode === 'audit' ? 'disable' : 'wait',
		sectionCapture,
		sectionSelectors,
		criticalSelectors: getDefaultCriticalSelectors(pageType),
		waitSelectors: [],
		hideSelectors: [],
		authMethod,
		outputFormat,
		outputFolderStyle: outputStyle,
		outputFolder: customOutput,
	};

	// ── Summary & Confirm ──────────────────────────────────────────────────
	return confirmJob(job);
}

// =============================================================================
// Summary & Confirmation
// =============================================================================

async function confirmJob(job: ScreenshotJob): Promise<ScreenshotJob | null> {
	const pageSlug = createPageSlug(job.url);

	console.log('\n' + '─'.repeat(56));
	console.log('📋  SCREENSHOT JOB SUMMARY');
	console.log('─'.repeat(56));
	console.log(`  Page type:     ${job.pageType}`);
	console.log(`  URL:           ${job.url}`);
	console.log(`  Page slug:     ${pageSlug}`);
	console.log(`  Profile:       ${job.viewportProfile}`);
	console.log(`  Viewports:     ${job.viewports.length}`);
	for (const vp of job.viewports) {
		console.log(`                   ${formatViewport(vp)}`);
	}
	if (job.pageType === 'invitation') {
		console.log(`  Invitation set: ${job.invitationSet}`);
		console.log(`  Reveal mode:    ${job.revealHandling}`);
	} else {
		console.log(`  Page set:       ${job.generalSet}`);
	}
	console.log(`  Mode:          ${job.mode}`);
	console.log(`  Sections:      ${job.sectionCapture}`);
	if (job.sectionSelectors?.length) {
		console.log(`  Selectors:     ${job.sectionSelectors.join(', ')}`);
	}
	console.log(`  Auth:          ${job.authMethod}`);
	console.log(`  Format:        ${job.outputFormat}`);
	console.log(`  Output style:  ${job.outputFolderStyle}`);
	console.log(`  Output dir:    screenshots/${pageSlug}/`);
	console.log('─'.repeat(56));
	console.log('');

	const action = await select<'run' | 'edit' | 'cancel'>({
		message: 'Ready to run?',
		choices: [
			{ name: '▶  Run screenshots', value: 'run' },
			{ name: '✎  Edit settings', value: 'edit' },
			{ name: '✕  Cancel', value: 'cancel' },
		],
		default: 'run',
	});

	if (action === 'run') return job;
	if (action === 'cancel') {
		console.log('\n✕  Cancelled by user.\n');
		return null;
	}

	// Edit — start over
	console.log('\nRestarting interactive flow...\n');
	return runInteractiveFlow();
}
