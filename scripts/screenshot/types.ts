// =============================================================================
// CELEBRA-ME | Screenshot Tool — Type Definitions
// =============================================================================

/** Type of page to capture */
export type PageType = 'invitation' | 'landing' | 'dashboard' | 'admin' | 'login' | 'custom';

/** Viewport profile selector */
export type ViewportProfileType = 'invitation' | 'site' | 'full' | 'single' | 'custom';

/** Screenshot preparation mode */
export type ScreenshotMode = 'audit' | 'raw';

/** Screenshot set for invitation pages */
export type InvitationSet = 'essential' | 'full-qa' | 'reveal-only' | 'full-page';

/** Screenshot set for general pages */
export type GeneralSet = 'basic' | 'full-qa';

/** How to handle reveal sections (invitation only) */
export type RevealHandling = 'auto' | 'force-open' | 'closed-only' | 'open-only' | 'skip';

/** How to handle CSS animations */
export type AnimationHandling = 'disable' | 'wait' | 'query-param' | 'custom';

/** Whether and how to capture individual sections */
export type SectionCapture = 'none' | 'auto' | 'known' | 'custom' | 'single';

/** How to frame individual section / critical element screenshots */
export type SectionExtent = 'full' | 'viewport';

/** Authentication method */
export type AuthMethod = 'none' | 'existing-session' | 'storage-state' | 'manual-login';

/** Output image format */
export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'pdf';

/** Output folder strategy */
export type OutputFolderStyle = 'default' | 'timestamped' | 'custom' | 'overwrite';

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export interface Viewport {
	width: number;
	height: number;
	deviceScaleFactor: number;
	/** Human-readable label, e.g. "mobile-standard" */
	name: string;
}

export type CaptureTarget =
	'full-page' | 'critical-qa' | 'all-sections' | 'single-section' | 'reveal-only';

export interface ScreenshotWarning {
	message: string;
	target?: string;
	selector?: string;
	viewport?: string;
	expected: boolean;
}

export interface BlankBottomValidation {
	path: string;
	width: number;
	height: number;
	trailingBlankSpaceDetected: boolean;
	stitchedNecessary: boolean;
	note: string;
}

export interface ScreenshotJob {
	pageType: PageType;
	mode: ScreenshotMode;
	/** Resolved full URL to capture (e.g. http://localhost:4321/boda/...) */
	url: string;
	/** Base URL for route resolution (e.g. http://localhost:4321) */
	baseUrl: string;
	viewportProfile: ViewportProfileType;
	/** Resolved list of viewport configurations to capture */
	viewports: Viewport[];
	target: CaptureTarget;
	includeLayout?: boolean;
	invitationSet?: InvitationSet;
	generalSet?: GeneralSet;
	revealHandling: RevealHandling;
	animationHandling: AnimationHandling;
	sectionCapture: SectionCapture;
	/**
	 * Framing for section/critical element captures.
	 * `full` = entire element height; `viewport` = visible viewport crop only.
	 */
	sectionExtent: SectionExtent;
	selectedSection?: string;
	/** Exact section IDs resolved by the canonical scope resolver. */
	selectedSections?: string[];
	criticalSelectors: ScreenshotSelectorConfig[];
	waitSelectors: string[];
	hideSelectors: string[];
	authMethod: AuthMethod;
	outputFormat: OutputFormat;
	outputFolderStyle: OutputFolderStyle;
	/** Custom output folder (only when outputFolderStyle === 'custom') */
	outputFolder?: string;
	/** Canonical, preflight-validated scope consumed by downstream capture code. */
	scope?: import('./scope.js').ResolvedScreenshotPlan;
}

/** Options parsed from CLI flags */
export interface CliOptions {
	/** Force interactive mode even when flags are present (--interactive) */
	interactive?: boolean;
	help?: boolean;
	url?: string;
	baseUrl?: string;
	pageType?: PageType;
	mode?: ScreenshotMode;
	/** Viewport names to capture, e.g. ['mobile-standard', 'desktop'] */
	viewport?: string[];
	profile?: ViewportProfileType;
	target?: CaptureTarget;
	includeLayout?: boolean;
	invitationSet?: InvitationSet;
	generalSet?: GeneralSet;
	reveal?: RevealHandling;
	animation?: AnimationHandling;
	/** Comma-separated section names for known sections */
	sections?: string;
	/** Framing for section captures: full element or viewport crop */
	sectionExtent?: SectionExtent;
	auth?: AuthMethod;
	format?: OutputFormat;
	/** Custom output folder path */
	output?: string;
	outputStyle?: OutputFolderStyle;
	/** Path to a config JSON file */
	config?: string;
	/** Use Local Render Corpus SSOT pages (17 supported Production clients) */
	corpus?: boolean;
	/** Remove output directory before starting */
	clean?: boolean;
	/** Permit config batches above the normal targeted execution budget. */
	allowLarge?: boolean;
}

/** Minimal shape for a screenshot config JSON file */
export interface ScreenshotConfig {
	baseUrl?: string;
	outputDir?: string;
	defaultMode?: ScreenshotMode;
	defaultViewportProfile?: ViewportProfileType;
	defaultAnimationHandling?: AnimationHandling;
	defaultOutputFormat?: OutputFormat;
	defaultOutputFolderStyle?: OutputFolderStyle;
	pages?: ScreenshotConfigPage[];
}

export interface ScreenshotConfigPage {
	name: string;
	pageType: PageType;
	route: string;
	mode?: ScreenshotMode;
	viewports?: string[];
	profile?: ViewportProfileType;
	target?: CaptureTarget;
	includeLayout?: boolean;
	invitationSet?: InvitationSet;
	generalSet?: GeneralSet;
	revealHandling?: RevealHandling;
	animationHandling?: AnimationHandling;
	sectionCapture?: SectionCapture;
	sections?: string[];
	sectionExtent?: SectionExtent;
	criticalSelectors?: ScreenshotSelectorConfig[];
	waitSelectors?: string[];
	hideSelectors?: string[];
	authMethod?: AuthMethod;
	outputFormat?: OutputFormat;
}

export interface ScreenshotSelectorConfig {
	selector: string;
	required: boolean;
	capture?: boolean;
	label?: string;
}

/** Result of a single screenshot capture */
export interface CaptureResult {
	id?: string;
	path: string;
	viewportName: string;
	label: string;
	success: boolean;
	error?: string;
	fallback?: 'native-full-page';
	stitchFailures?: string[];
	isOptional?: boolean;
	hash?: string;
	sizeBytes?: number;
	mtimeMs?: number;
	strategy?: 'direct' | 'stitched';
	verificationStatus?: 'passed' | 'failed';
	/**
	 * Document-space CSS bounding box for section fragments used by
	 * `section-composite` (scrollY + getBoundingClientRect).
	 */
	documentBounds?: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

export type ValidationStatus = 'passed' | 'warning' | 'partial' | 'failed';

export type RequestFailureSeverity = 'critical' | 'warning';

export interface ScreenshotOutputFileReport {
	path: string;
	label: string;
	width?: number;
	height?: number;
	hash?: string;
	sizeBytes?: number;
	mtimeMs?: number;
	strategy?: 'direct' | 'stitched';
	verificationStatus?: 'passed' | 'failed';
}

export interface SelectorValidationReport {
	selector: string;
	required: boolean;
	label?: string;
	visibleBeforeNormalization?: boolean;
	visibleAfterNormalization?: boolean;
	status: ValidationStatus;
	warnings?: string[];
	failures?: string[];
}

export interface RequestFailureReport {
	url: string;
	method: string;
	errorText: string;
	severity: RequestFailureSeverity;
}

export interface ConsoleErrorReport {
	message: string;
	severity: RequestFailureSeverity;
	source: 'page-script' | 'browser' | 'test-runner-transpiler';
	environment: 'development' | 'unknown';
	productionRisk: 'unlikely' | 'unknown' | 'none';
	affectsScreenshotReliability: boolean;
	note: string;
}

export interface ViewportManifestReport {
	name: string;
	files: number;
	/** Required planned captures for this viewport (SSOT from resolveCapturePlan). */
	expected: number;
	status: ValidationStatus;
	/** Total planned tasks including optional. */
	plannedTotal?: number;
	requiredExpected?: number;
	requiredVerified?: number;
	optionalExpected?: number;
	optionalGenerated?: number;
	optionalOmitted?: number;
	missingRequiredTaskIds?: string[];
}

export interface SectionCoverageReport {
	expectedCount: number;
	renderedCount: number;
	plannedCount: number;
	successfulCount: number;
	missingSections: string[];
	duplicateSections: string[];
	sections: Array<{
		id: string;
		order: number;
		label: string;
		selector: string;
		status: 'captured' | 'failed' | 'missing' | 'duplicate';
		file?: string;
	}>;
}

export interface ViewportRunReport {
	name: string;
	width: number;
	height: number;
	deviceScaleFactor: number;
	documentHeight: number;
	outputFiles: ScreenshotOutputFileReport[];
	criticalSelectors: SelectorValidationReport[];
	sectionCoverage?: SectionCoverageReport;
	warnings: string[];
	detailedWarnings?: ScreenshotWarning[];
	notices?: string[];
	fallback?: 'native-full-page';
	stitchFailures?: string[];
	blankBottomValidations?: BlankBottomValidation[];
	/** Required capture-task failures for this viewport. */
	captureFailures?: string[];
	/** Post-capture validation failures (selectors, dimensions, coverage). */
	validationFailures?: string[];
	/** Union of capture + validation failures (backward-compatible). */
	failures: string[];
	consoleErrors: ConsoleErrorReport[];
	requestFailures: RequestFailureReport[];
}

export interface ScreenshotRunReport {
	route: string;
	mode: ScreenshotMode;
	startedAt: string;
	durationMs: number;
	status: ValidationStatus;
	viewports: ViewportRunReport[];
	manifest: ViewportManifestReport[];
	warnings: string[];
	detailedWarnings?: ScreenshotWarning[];
	notices?: string[];
	blankBottomValidations?: BlankBottomValidation[];
	captureFailures?: string[];
	validationFailures?: string[];
	manifestFailures?: string[];
	/** Union of blocking failure messages. */
	failures: string[];
	/** The same resolved plan persisted in preflight.json, echoed for correlation. */
	scope?: import('./scope.js').ResolvedScreenshotPlan;
}

/** Overall job result */
export interface JobResult {
	total: number;
	/** Successful required capture tasks. */
	succeeded: number;
	/**
	 * Blocking failure count (capture + validation + manifest).
	 * Used for process exit code.
	 */
	failed: number;
	captureFailed?: number;
	validationFailed?: number;
	manifestFailed?: number;
	blockingErrors?: number;
	warningCount?: number;
	noticeCount?: number;
	captures: CaptureResult[];
	outputDir: string;
	durationMs: number;
	report?: ScreenshotRunReport;
}

/** Named viewport profile mapping */
export interface ViewportProfile {
	name: string;
	viewports: Viewport[];
}

// ---------------------------------------------------------------------------
// Viewport profiles
// ---------------------------------------------------------------------------

export const VIEWPORT_PROFILES: Record<string, ViewportProfile> = {
	invitation: {
		name: 'invitation',
		viewports: [
			{ width: 360, height: 740, deviceScaleFactor: 2, name: 'mobile-narrow' },
			{ width: 390, height: 844, deviceScaleFactor: 2, name: 'mobile-standard' },
			{ width: 430, height: 932, deviceScaleFactor: 3, name: 'mobile-large' },
		],
	},
	site: {
		name: 'site',
		viewports: [
			{ width: 360, height: 740, deviceScaleFactor: 2, name: 'mobile-narrow' },
			{ width: 390, height: 844, deviceScaleFactor: 2, name: 'mobile-standard' },
			{ width: 768, height: 1024, deviceScaleFactor: 2, name: 'tablet' },
			{ width: 1440, height: 1200, deviceScaleFactor: 1, name: 'desktop' },
		],
	},
	full: {
		name: 'full',
		viewports: [
			{ width: 360, height: 740, deviceScaleFactor: 2, name: 'mobile-narrow' },
			{ width: 390, height: 844, deviceScaleFactor: 2, name: 'mobile-standard' },
			{ width: 430, height: 932, deviceScaleFactor: 3, name: 'mobile-large' },
			{ width: 768, height: 1024, deviceScaleFactor: 2, name: 'tablet' },
			{ width: 1440, height: 1200, deviceScaleFactor: 1, name: 'desktop' },
		],
	},
	single: {
		name: 'single',
		viewports: [],
	},
};

// ---------------------------------------------------------------------------
// Known sections registry
// ---------------------------------------------------------------------------

export interface KnownSection {
	id: string;
	label: string;
	pageType: PageType;
	selector: string;
	fallbackSelectors?: string[];
	outputSlug: string;
}

export const KNOWN_SECTIONS: KnownSection[] = [
	// Landing Sections
	{
		id: 'hero',
		label: 'Hero',
		pageType: 'landing',
		selector: '[data-screenshot="landing-hero"]',
		fallbackSelectors: ['#inicio', '.hero-prime'],
		outputSlug: 'hero',
	},
	{
		id: 'event-selector',
		label: 'Event Selector',
		pageType: 'landing',
		selector: '[data-screenshot="landing-event-selector"]',
		fallbackSelectors: ['#tipo-evento'],
		outputSlug: 'event-selector',
	},
	{
		id: 'product-proof',
		label: 'Product Proof',
		pageType: 'landing',
		selector: '[data-screenshot="landing-product-proof"]',
		fallbackSelectors: ['#prueba-producto'],
		outputSlug: 'product-proof',
	},
	{
		id: 'services',
		label: 'Services',
		pageType: 'landing',
		selector: '[data-screenshot="landing-includes"]',
		fallbackSelectors: ['#servicios'],
		outputSlug: 'services',
	},
	{
		id: 'guest-experience',
		label: 'Guest Experience',
		pageType: 'landing',
		selector: '[data-screenshot="landing-guest-experience"]',
		fallbackSelectors: ['#experiencia-invitados'],
		outputSlug: 'guest-experience',
	},
	{
		id: 'about-us',
		label: 'About Us',
		pageType: 'landing',
		selector: '[data-screenshot="landing-about"]',
		fallbackSelectors: ['#sobre-nosotros'],
		outputSlug: 'about-us',
	},
	{
		id: 'how-it-works',
		label: 'How It Works',
		pageType: 'landing',
		selector: '[data-screenshot="landing-process"]',
		fallbackSelectors: ['#como-funciona'],
		outputSlug: 'how-it-works',
	},
	{
		id: 'testimonials',
		label: 'Testimonials',
		pageType: 'landing',
		selector: '[data-screenshot="landing-testimonials"]',
		fallbackSelectors: ['#testimonios'],
		outputSlug: 'testimonials',
	},
	{
		id: 'pricing',
		label: 'Pricing',
		pageType: 'landing',
		selector: '[data-screenshot="landing-pricing"]',
		fallbackSelectors: ['#pricing'],
		outputSlug: 'pricing',
	},
	{
		id: 'faq',
		label: 'FAQ',
		pageType: 'landing',
		selector: '[data-screenshot="landing-faq"]',
		fallbackSelectors: ['#faq-section'],
		outputSlug: 'faq',
	},
	{
		id: 'contact',
		label: 'Contact',
		pageType: 'landing',
		selector: '[data-screenshot="landing-contact"]',
		fallbackSelectors: ['#contacto'],
		outputSlug: 'contact',
	},

	// Invitation Sections
	{
		id: 'hero',
		label: 'Hero',
		pageType: 'invitation',
		selector: '[data-screenshot-section="hero"]',
		fallbackSelectors: ['[data-screenshot="invitation-open-hero"]', '#inicio'],
		outputSlug: 'hero',
	},
	{
		id: 'quote',
		label: 'Quote',
		pageType: 'invitation',
		selector: '[data-screenshot-section="quote"]',
		outputSlug: 'quote',
	},
	{
		id: 'family',
		label: 'Family',
		pageType: 'invitation',
		selector: '[data-screenshot-section="family"]',
		outputSlug: 'family',
	},
	{
		id: 'gallery',
		label: 'Gallery',
		pageType: 'invitation',
		selector: '[data-screenshot-section="gallery"]',
		fallbackSelectors: ['#galeria'],
		outputSlug: 'gallery',
	},
	{
		id: 'countdown',
		label: 'Countdown',
		pageType: 'invitation',
		selector: '[data-screenshot-section="countdown"]',
		fallbackSelectors: ['#countdown'],
		outputSlug: 'countdown',
	},
	{
		id: 'location',
		label: 'Location',
		pageType: 'invitation',
		selector: '[data-screenshot-section="location"]',
		fallbackSelectors: ['#event-location'],
		outputSlug: 'location',
	},
	{
		id: 'itinerary',
		label: 'Itinerary',
		pageType: 'invitation',
		selector: '[data-screenshot-section="itinerary"]',
		fallbackSelectors: ['#itinerary'],
		outputSlug: 'itinerary',
	},
	{
		id: 'rsvp',
		label: 'RSVP',
		pageType: 'invitation',
		selector: '[data-screenshot-section="rsvp"]',
		fallbackSelectors: ['#rsvp'],
		outputSlug: 'rsvp',
	},
	{
		id: 'gifts',
		label: 'Gifts',
		pageType: 'invitation',
		selector: '[data-screenshot-section="gifts"]',
		fallbackSelectors: ['#regalos'],
		outputSlug: 'gifts',
	},
	{
		id: 'thankYou',
		label: 'Thank You',
		pageType: 'invitation',
		selector: '[data-screenshot-section="thankYou"]',
		fallbackSelectors: ['#thank-you-section'],
		outputSlug: 'thankYou',
	},
	{
		id: 'personalized-access',
		label: 'Personalized Access',
		pageType: 'invitation',
		selector: '[data-screenshot-section="personalized-access"]',
		outputSlug: 'personalized-access',
	},
];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Fallback base URL for Integration / `dev-local` (port 4321).
 * Prefer {@link resolveScreenshotBaseUrl} so `dev-extra` / `dev-preview` lanes
 * bind to their stable ports (4322 / 4323).
 */
export const DEFAULT_BASE_URL = 'http://localhost:4321';
export const DEFAULT_STORAGE_STATE_PATH = 'playwright/.auth/user.json';
export const DEFAULT_NAVIGATION_TIMEOUT = 15_000;
export const DEFAULT_NETWORK_IDLE_TIMEOUT = 5_000;
export const DEFAULT_ELEMENT_TIMEOUT = 2_000;
export const DEFAULT_FONT_TIMEOUT = 3_000;
export const DEFAULT_IMAGE_TIMEOUT = 2_000;
export const DEFAULT_STABILITY_DELAY = 300;
