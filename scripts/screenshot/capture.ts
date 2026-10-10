// =============================================================================
// CELEBRA-ME | Screenshot Tool — Capture Facade (compatibility re-exports)
// =============================================================================

import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as path from 'node:path';
import { DEFAULT_STORAGE_STATE_PATH, type AuthMethod, type Viewport } from './types.js';

/**
 * Launch a headless Chromium browser instance.
 */
export async function launchBrowser(): Promise<Browser> {
	return chromium.launch({
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-gpu',
		],
	});
}

/**
 * Create a new browser context with the specified viewport.
 * Each context gets a clean storage state and viewport.
 */
export function createContext(
	browser: Browser,
	viewport: Viewport,
	options: { authMethod?: AuthMethod } = {},
): Promise<BrowserContext> {
	return browser.newContext({
		viewport: { width: viewport.width, height: viewport.height },
		deviceScaleFactor: viewport.deviceScaleFactor,
		locale: 'es-MX',
		timezoneId: 'America/Mexico_City',
		acceptDownloads: false,
		...(options.authMethod === 'storage-state'
			? { storageState: path.resolve(process.cwd(), DEFAULT_STORAGE_STATE_PATH) }
			: {}),
	});
}

// --- Plan ---
export {
	type CaptureTask,
	type PlannedCaptureTask,
	plannedTasksFromCapturePlan,
	withTaskIdentity,
	assertCapturePlanScopeOwnership,
	probeFirstMatchingSelectors,
	resolveCapturePlan,
} from './capture-plan.js';

// --- Composite ---
export {
	type SectionCompositeFragment,
	listOrderedSectionCapturePaths,
	parseSectionCaptureIdentity,
	planDocumentCaptureStrips,
	assertContinuousDocumentStrips,
	resolveInvitationDocumentCaptureRange,
	planDocumentStripPhysicalPlacement,
	assertContinuousPhysicalStripPlacements,
	computeDocumentCompositeLayout,
	compositeSectionCapturePngs,
} from './composite.js';

// --- Page preparation ---
export { prepareAuditPage } from './page-preparation.js';

// --- Navigation ---
export {
	buildScreenshotUrl,
	clearEnvelopeOpenedKeys,
	isSameScreenshotNavigationUrl,
} from './navigation.js';

// --- Reveal ---
export {
	createRevealOcclusionCache,
	shouldSkipInvitationOpenCapture,
	evaluateRevealCompletedForContent,
	normalizeInvitationRevealedForCapture,
	isRevealLetterLaidOut,
	waitForRevealLetterLaidOut,
	evaluateRevealIsOpen,
	evaluateRevealDoesNotOcclude,
} from './reveal.js';

// --- Element capture ---
export { hideFixedOverlaysForCapture } from './element-capture.js';

// --- Invitation ---
export { captureInvitationScreenshots } from './invitation-capture.js';

// --- General ---
export { captureGeneralPageScreenshots } from './general-capture.js';
