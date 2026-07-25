// =============================================================================
// CELEBRA-ME | Screenshot Tool — Interactive CLI Flow
// =============================================================================

import { input, select } from '@inquirer/prompts';
import {
	type PageType,
	type ViewportProfileType,
	type RevealHandling,
	type SectionCapture,
	type AuthMethod,
	type OutputFormat,
	type OutputFolderStyle,
	type ScreenshotJob,
	type Viewport,
	type ScreenshotMode,
	type CaptureTarget,
	DEFAULT_BASE_URL,
	KNOWN_SECTIONS,
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
import { discoverAllInvitations, discoverStaticDemos, discoverStaticTemplates } from './discovery.js';

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
				description: 'Mobile-only set: mobile-narrow, mobile-standard, mobile-large. Recommended responsive set for invitation QA.',
				value: 'invitation',
			},
			{
				name: `Site        (${getViewportProfileSummary('site')})`,
				description: 'Recommended responsive set for landing / general page QA: mobile-narrow, mobile-standard, tablet, desktop.',
				value: 'site',
			},
			{
				name: `Full        (${getViewportProfileSummary('full')})`,
				description: 'All five viewports: mobile-narrow, mobile-standard, mobile-large, tablet, desktop.',
				value: 'full',
			},
			{
				name: 'Single viewport (pick one)',
				description: 'Capture only one specific viewport — useful for fast iteration.',
				value: 'single',
			},
		],
		default: defaultProfile,
	});

	if (choice === 'single') {
		const vpName = await select<string>({
			message: 'Which viewport?',
			choices: [
				{
					name: 'mobile-narrow   (360×740, @2x)',
					description: 'Smallest common mobile size; stresses typography and CTA legibility.',
					value: 'mobile-narrow',
				},
				{
					name: 'mobile-standard (390×844, @2x)',
					description: 'Default iPhone-class viewport. Most common mobile reference.',
					value: 'mobile-standard',
				},
				{
					name: 'mobile-large    (430×932, @3x)',
					description: 'Pro Max-class viewport; useful to spot spacing regressions.',
					value: 'mobile-large',
				},
				{
					name: 'tablet          (768×1024, @2x)',
					description: 'Portrait tablet; transition layout between mobile and desktop.',
					value: 'tablet',
				},
				{
					name: 'desktop         (1440×1200, @1x)',
					description: 'Wide layout capture for desktop review.',
					value: 'desktop',
				},
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
 * Run the interactive CLI flow: ask questions, show summary, confirm.
 * Returns a ScreenshotJob config or an array of configs, or null if cancelled.
 */
// eslint-disable-next-line complexity -- Sequential prompt sequence for interactive wizard
export async function runInteractiveFlow(): Promise<ScreenshotJob | ScreenshotJob[] | null> {
	console.log('\n📸  Celebra-me Screenshot Tool\n');

	// ── 1. Page Type ───────────────────────────────────────────────────────
	const pageType = await select<PageType>({
		message: 'What do you want to screenshot?',
		choices: [
			{
				name: 'Invitation page / Event Demo   (e.g. /boda/demo-boda-jewelry-box-wedding)',
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

	// ── 2. Route selection ──────────────────────────────────────────────────
	let resolvedUrls: { name: string; url: string }[];
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

	if (pageType === 'invitation') {
		const selectionMode = await select<string>({
			message: 'Select the invitation or demo to capture:',
			choices: [
				{ name: 'Select from All Discovered Invitations (Demos, Provisioned, DB)...', value: 'select-all-discovered' },
				{ name: 'Select from Event Demos...', value: 'select-demo' },
				{ name: 'Select from Invitation Templates...', value: 'select-template' },
				{ name: 'Capture ALL Discovered Invitations', value: 'all-discovered' },
				{ name: 'Capture ALL Event Demos', value: 'all-demos' },
				{ name: 'Capture ALL Templates', value: 'all-templates' },
				{ name: 'Enter route/URL manually', value: 'manual' },
			],
			default: 'select-all-discovered',
		});

		if (selectionMode === 'select-all-discovered') {
			const discovered = discoverAllInvitations();
			if (discovered.length === 0) {
				console.warn('  ⚠ No invitations discovered.');
				return null;
			}
			const chosenRoute = await select<string>({
				message: 'Which invitation?',
				choices: discovered.map((d) => ({
					name: `${d.name} (${d.source}) [${d.route}]`,
					value: d.route,
				})),
			});
			resolvedUrls = [{ name: createPageSlug(chosenRoute), url: chosenRoute }];
		} else if (selectionMode === 'select-demo') {
			const demos = discoverStaticDemos();
			if (demos.length === 0) {
				console.warn('  ⚠ No event demos found in src/content/event-demos.');
				return null;
			}
			const chosenRoute = await select<string>({
				message: 'Which event demo?',
				choices: demos.map((d) => ({ name: d.name, value: d.route })),
			});
			resolvedUrls = [{ name: createPageSlug(chosenRoute), url: chosenRoute }];
		} else if (selectionMode === 'select-template') {
			const templates = discoverStaticTemplates();
			if (templates.length === 0) {
				console.warn('  ⚠ No templates found in src/content/event-templates.');
				return null;
			}
			const chosenRoute = await select<string>({
				message: 'Which invitation template?',
				choices: templates.map((t) => ({ name: t.name, value: t.route })),
			});
			resolvedUrls = [{ name: createPageSlug(chosenRoute), url: chosenRoute }];
		} else if (selectionMode === 'all-discovered') {
			const discovered = discoverAllInvitations();
			if (discovered.length === 0) {
				console.warn('  ⚠ No invitations discovered.');
				return null;
			}
			resolvedUrls = discovered.map((d) => ({ name: d.slug, url: d.route }));
		} else if (selectionMode === 'all-demos') {
			const demos = discoverStaticDemos();
			if (demos.length === 0) {
				console.warn('  ⚠ No event demos found in src/content/event-demos.');
				return null;
			}
			resolvedUrls = demos.map((d) => ({ name: d.slug, url: d.route }));
		} else if (selectionMode === 'all-templates') {
			const templates = discoverStaticTemplates();
			if (templates.length === 0) {
				console.warn('  ⚠ No templates found in src/content/event-templates.');
				return null;
			}
			resolvedUrls = templates.map((t) => ({ name: t.slug, url: t.route }));
		} else {
			const urlInput = await input({
				message: 'URL or route to capture:',
				default: defaultRoute,
				validate: (value) => (value.trim().length > 0 ? true : 'Route cannot be empty'),
			});
			resolvedUrls = [{ name: createPageSlug(urlInput), url: urlInput }];
		}
	} else {
		const urlInput = await input({
			message: 'URL or route to capture:',
			default: defaultRoute,
			validate: (value) => (value.trim().length > 0 ? true : 'Route cannot be empty'),
		});
		resolvedUrls = [{ name: createPageSlug(urlInput), url: urlInput }];
	}

	// Base URL resolution
	let baseUrl = DEFAULT_BASE_URL;
	const hasRelativeRoute = resolvedUrls.some((item) => !/^https?:\/\//i.test(item.url.trim()));
	if (hasRelativeRoute) {
		baseUrl = await input({
			message: 'Base URL:',
			default: DEFAULT_BASE_URL,
		});
	}

	const resolvedJobsUrls = resolvedUrls.map((item) => ({
		name: item.name,
		url: resolveUrl(item.url, baseUrl),
	}));

	// ── 3. Target Capture Mode ─────────────────────────────────────────────
	const target = await select<CaptureTarget>({
		message: 'What is the target of this screenshot run?',
		choices: [
			{
				name: 'Full page         (full-page captures only)',
				description:
					pageType === 'invitation'
						? 'Captures initial (closed) and opened full-page states for the invitation. For landing pages: one full-page screenshot.'
						: 'Captures only full-page screenshots for the selected viewport(s).',
				value: 'full-page',
			},
			{
				name: 'Critical QA set   (full-page + predefined critical sections)',
				description: 'Captures the full page plus predefined critical sections (e.g. hero, pricing, faq, contact).',
				value: 'critical-qa',
			},
			{
				name: 'All sections      (one screenshot per registered section)',
				description:
					pageType === 'invitation'
						? 'Captures each visible opened invitation section individually. No full-page baseline. For full-page initial/opened states use Critical QA or Full Page target.'
						: 'Captures one screenshot per registered section, skipping full-page unless layout is explicitly included.',
				value: 'all-sections',
			},
			{
				name: 'Single section    (only the selected section)',
				description: 'Captures exactly one selected section, skipping all page-level and other section screenshots.',
				value: 'single-section',
			},
		],
		default: 'critical-qa',
	});

	let includeLayout = false;
	if (target === 'critical-qa') {
		if (pageType !== 'invitation') {
			includeLayout = await select<boolean>({
				message: 'Do you want to include standard layout captures (viewport, header, main, footer)?',
				choices: [
					{ name: 'Yes, include standard layout captures', value: true },
					{ name: 'No, only capture critical sections and full page', value: false },
				],
				default: true,
			});
		}
		// For invitations, includeLayout is always false — layout captures
		// (viewport, header, main, footer) are not relevant for invitation pages.
	}

	// ── 4. Single Section Selection ─────────────────────────────────────────
	let selectedSection: string | undefined;
	let sectionCapture: SectionCapture = 'none';
	if (target === 'single-section') {
		const availableSections = KNOWN_SECTIONS.filter((s) => s.pageType === pageType);
		if (availableSections.length === 0) {
			console.warn('  ⚠ No known sections registered for page type:', pageType);
			return null;
		}
		selectedSection = await select<string>({
			message: 'Which section do you want to capture?',
			choices: availableSections.map((s) => ({ name: s.label, value: s.id })),
		});
		sectionCapture = 'single';
	} else if (target === 'all-sections') {
		sectionCapture = 'known';
	}

	// ── 5. Viewport Profile ────────────────────────────────────────────────
	const defaultProfile = getDefaultProfile(pageType);
	const { viewportProfile, viewports } = await askViewportProfile(defaultProfile);

	// ── 6. Reveal Handling (invitation only) ───────────────────────────────
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

	// ── 7. Screenshot Mode ─────────────────────────────────────────────────
	const mode = await select<ScreenshotMode>({
		message: 'Screenshot mode?',
		choices: [
			{
				name: 'Audit',
				description: 'Stable visual QA: waits for content, reduces motion, and disables scroll snapping.',
				value: 'audit',
			},
			{
				name: 'Raw',
				description: 'Minimal intervention: captures the page closer to actual runtime behavior for debugging.',
				value: 'raw',
			},
		],
		default: 'audit',
	});

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

	// ── Assemble Job(s) ───────────────────────────────────────────────────────
	const jobs: ScreenshotJob[] = resolvedJobsUrls.map((item) => ({
		pageType,
		mode,
		url: item.url,
		baseUrl,
		viewportProfile,
		viewports,
		target,
		includeLayout,
		revealHandling,
		animationHandling: mode === 'audit' ? 'disable' : 'wait',
		sectionCapture,
		selectedSection,
		sectionSelectors: undefined,
		criticalSelectors: getDefaultCriticalSelectors(pageType),
		waitSelectors: [],
		hideSelectors: [],
		authMethod,
		outputFormat,
		outputFolderStyle: outputStyle,
		outputFolder: customOutput,
	}));

	return confirmJobs(jobs);
}

// =============================================================================
// Summary & Confirmation
// =============================================================================

async function confirmJobs(jobs: ScreenshotJob[]): Promise<ScreenshotJob[] | ScreenshotJob | null> {
	const isBatch = jobs.length > 1;

	console.log('\n' + '─'.repeat(56));
	console.log(`📋  SCREENSHOT JOB SUMMARY${isBatch ? ' (BATCH RUN)' : ''}`);
	console.log('─'.repeat(56));
	if (isBatch) {
		console.log(`  Pages to capture (${jobs.length}):`);
		for (const j of jobs) {
			console.log(`                   - ${j.url}`);
		}
	} else {
		console.log(`  Page type:     ${jobs[0].pageType}`);
		console.log(`  URL:           ${jobs[0].url}`);
		console.log(`  Page slug:     ${createPageSlug(jobs[0].url)}`);
	}
	console.log(`  Profile:       ${jobs[0].viewportProfile}`);
	console.log(`  Viewports:     ${jobs[0].viewports.length}`);
	for (const vp of jobs[0].viewports) {
		console.log(`                   ${formatViewport(vp)}`);
	}
	if (jobs[0].pageType === 'invitation') {
		console.log(`  Reveal mode:    ${jobs[0].revealHandling}`);
	}
	console.log(`  Target:        ${jobs[0].target}`);
	if (jobs[0].pageType === 'invitation' && jobs[0].target === 'full-page') {
		console.log('  Captures:      Full page states — initial (closed) + opened invitation');
	}
	if (jobs[0].pageType !== 'invitation' && jobs[0].includeLayout) {
		console.log(`  Incl. Layout:  Yes`);
	}
	console.log(`  Mode:          ${jobs[0].mode}`);
	if (jobs[0].selectedSection) {
		console.log(`  Sel. Section:  ${jobs[0].selectedSection}`);
	}
	if (jobs[0].sectionSelectors?.length) {
		console.log(`  Selectors:     ${jobs[0].sectionSelectors.join(', ')}`);
	}
	console.log(`  Auth:          ${jobs[0].authMethod}`);
	console.log(`  Format:        ${jobs[0].outputFormat}`);
	console.log(`  Output style:  ${jobs[0].outputFolderStyle}`);
	if (!isBatch) {
		console.log(`  Output dir:    screenshots/${createPageSlug(jobs[0].url)}/`);
	}
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

	if (action === 'run') {
		return isBatch ? jobs : jobs[0];
	}
	if (action === 'cancel') {
		console.log('\n✕  Cancelled by user.\n');
		return null;
	}

	// Edit — start over
	console.log('\nRestarting interactive flow...\n');
	return runInteractiveFlow();
}

