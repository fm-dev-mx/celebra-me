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
	type TaskRequirement,
	type CaptureTask,
	type PlannedCaptureTask,
	type CapturePlanResult,
	type ResolveCapturePlanOptions,
	getPlannedCaptureLabel,
	isCaptureTaskRequired,
	plannedTasksFromCapturePlan,
	withTaskIdentity,
	buildTaskFailureResult,
	probeFirstMatchingSelectors,
	resolveCapturePlan,
} from './capture-plan.js';

// --- Composite ---
export {
	type SectionCompositeFragment,
	type DocumentCompositePlacement,
	type DocumentCompositeLayout,
	type DocumentCaptureStrip,
	type DocumentCaptureStripPlan,
	type DocumentStripPhysicalPlacement,
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
export {
	waitForCustomElements,
	waitForBackgroundImages,
	waitForHeroReady,
	waitForPageStability,
	waitForFonts,
	waitForImages,
	scrollForLazyLoad,
	waitForLayoutHeightStable,
	disableAnimations,
	prepareAuditPage,
	prepareRawPage,
} from './page-preparation.js';

// --- Navigation ---
export {
	type ScreenshotRevealState,
	buildScreenshotUrl,
	clearEnvelopeOpenedKeys,
	isSameScreenshotNavigationUrl,
	navigateTo,
} from './navigation.js';

// --- Reveal ---
export {
	type RevealOcclusionCache,
	createRevealOcclusionCache,
	shouldSkipInvitationOpenCapture,
	assertInvitationContentReady,
	evaluateRevealCompletedForContent,
	normalizeInvitationRevealedForCapture,
	ensureInvitationOpenForCapture,
	findRevealSection,
	findRevealLetter,
	isRevealLetterLaidOut,
	waitForRevealLetterLaidOut,
	waitForRevealSectionLaidOut,
	type RevealOpenDomProbe,
	evaluateRevealIsOpen,
	type RevealOcclusionDomProbe,
	evaluateRevealDoesNotOcclude,
	checkRevealIsOpen,
	assertRevealDoesNotOccludeInvitation,
} from './reveal.js';

// --- Element capture ---
export {
	hideFixedOverlaysForCapture,
	captureFullPage,
	captureViewport,
	resetScrollAndAssertAboveFold,
	captureElement,
	pathLabel,
} from './element-capture.js';

// --- Landing ---
export { captureLandingStitchedFullPage } from './landing-capture.js';

// --- Invitation ---
export {
	captureInvitationDocumentSpaceFullPage,
	captureInvitationOpen,
	validateDistinctReveal,
} from './invitation-full-page.js';
export { captureInvitationScreenshots } from './invitation-capture.js';

// --- General ---
export { captureGeneralPageScreenshots } from './general-capture.js';
