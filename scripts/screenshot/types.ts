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
export type SectionCapture = 'none' | 'auto' | 'known' | 'custom';

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
	invitationSet?: InvitationSet;
	generalSet?: GeneralSet;
	revealHandling: RevealHandling;
	animationHandling: AnimationHandling;
	sectionCapture: SectionCapture;
	sectionSelectors?: string[];
	criticalSelectors: ScreenshotSelectorConfig[];
	waitSelectors: string[];
	hideSelectors: string[];
	authMethod: AuthMethod;
	outputFormat: OutputFormat;
	outputFolderStyle: OutputFolderStyle;
	/** Custom output folder (only when outputFolderStyle === 'custom') */
	outputFolder?: string;
}

/** Options parsed from CLI flags */
export interface CliOptions {
	/** Force interactive mode even when flags are present (--interactive) */
	interactive?: boolean;
	url?: string;
	baseUrl?: string;
	pageType?: PageType;
	mode?: ScreenshotMode;
	/** Viewport names to capture, e.g. ['mobile-standard', 'desktop'] */
	viewport?: string[];
	profile?: ViewportProfileType;
	invitationSet?: InvitationSet;
	generalSet?: GeneralSet;
	reveal?: RevealHandling;
	animation?: AnimationHandling;
	/** Comma-separated section names for known sections */
	sections?: string;
	/** Comma-separated CSS selectors for custom sections */
	sectionSelectors?: string;
	auth?: AuthMethod;
	format?: OutputFormat;
	/** Custom output folder path */
	output?: string;
	outputStyle?: OutputFolderStyle;
	/** Path to a config JSON file */
	config?: string;
	/** Remove output directory before starting */
	clean?: boolean;
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
	storageStatePath?: string;
	pages?: ScreenshotConfigPage[];
}

export interface ScreenshotConfigPage {
	name: string;
	pageType: PageType;
	route: string;
	mode?: ScreenshotMode;
	viewports?: string[];
	profile?: ViewportProfileType;
	invitationSet?: InvitationSet;
	generalSet?: GeneralSet;
	revealHandling?: RevealHandling;
	animationHandling?: AnimationHandling;
	sectionCapture?: SectionCapture;
	sectionSelectors?: string[];
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
	path: string;
	viewportName: string;
	label: string;
	success: boolean;
	error?: string;
}

export type ValidationStatus = 'passed' | 'warning' | 'failed';

export type RequestFailureSeverity = 'critical' | 'warning';

export interface ScreenshotOutputFileReport {
	path: string;
	label: string;
	width?: number;
	height?: number;
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
	source: 'vite-dev-runtime' | 'page-script' | 'browser';
	environment: 'development' | 'unknown';
	productionRisk: 'unlikely' | 'unknown';
	affectsScreenshotReliability: boolean;
	note: string;
}

export interface ViewportManifestReport {
	name: string;
	files: number;
	expected: number;
	status: ValidationStatus;
}

export interface ViewportRunReport {
	name: string;
	width: number;
	height: number;
	deviceScaleFactor: number;
	documentHeight: number;
	outputFiles: ScreenshotOutputFileReport[];
	criticalSelectors: SelectorValidationReport[];
	warnings: string[];
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
	failures: string[];
}

/** Overall job result */
export interface JobResult {
	total: number;
	succeeded: number;
	failed: number;
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
};

// ---------------------------------------------------------------------------
// Known invitation sections
// ---------------------------------------------------------------------------

export const KNOWN_INVITATION_SECTIONS: {
	id: string;
	label: string;
	selector: string;
	fallbackSelectors: string[];
}[] = [
	{
		id: 'quote',
		label: 'Quote',
		selector: '[data-screenshot-section="quote"]',
		fallbackSelectors: [],
	},
	{
		id: 'family',
		label: 'Family',
		selector: '[data-screenshot-section="family"]',
		fallbackSelectors: [],
	},
	{
		id: 'gallery',
		label: 'Gallery',
		selector: '[data-screenshot-section="gallery"]',
		fallbackSelectors: ['#galeria'],
	},
	{
		id: 'countdown',
		label: 'Countdown',
		selector: '[data-screenshot-section="countdown"]',
		fallbackSelectors: ['#countdown'],
	},
	{
		id: 'location',
		label: 'Location',
		selector: '[data-screenshot-section="location"]',
		fallbackSelectors: ['#event-location'],
	},
	{
		id: 'itinerary',
		label: 'Itinerary',
		selector: '[data-screenshot-section="itinerary"]',
		fallbackSelectors: ['#itinerary'],
	},
	{
		id: 'rsvp',
		label: 'RSVP',
		selector: '[data-screenshot-section="rsvp"]',
		fallbackSelectors: ['#rsvp'],
	},
	{
		id: 'gifts',
		label: 'Gifts',
		selector: '[data-screenshot-section="gifts"]',
		fallbackSelectors: ['#regalos'],
	},
	{
		id: 'thankYou',
		label: 'Thank You',
		selector: '[data-screenshot-section="thankYou"]',
		fallbackSelectors: ['#thank-you-section'],
	},
	{
		id: 'personalized-access',
		label: 'Personalized Access',
		selector: '[data-screenshot-section="personalized-access"]',
		fallbackSelectors: [],
	},
];

// ---------------------------------------------------------------------------
// Reveal trigger text patterns (ordered by priority)
// ---------------------------------------------------------------------------

export const REVEAL_TRIGGER_TEXTS: string[] = [
	'abrir',
	'open',
	'ver invitación',
	'view invitation',
	'descubrir',
	'discover',
	'continue',
	'continuar',
	'tap to open',
	'toca para abrir',
];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_BASE_URL = 'http://localhost:4321';
export const DEFAULT_STORAGE_STATE_PATH = 'playwright/.auth/user.json';
export const DEFAULT_NAVIGATION_TIMEOUT = 30_000;
export const DEFAULT_NETWORK_IDLE_TIMEOUT = 10_000;
export const DEFAULT_ELEMENT_TIMEOUT = 5_000;
export const DEFAULT_FONT_TIMEOUT = 10_000;
export const DEFAULT_IMAGE_TIMEOUT = 10_000;
export const DEFAULT_STABILITY_DELAY = 500;
