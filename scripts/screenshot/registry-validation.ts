// =============================================================================
// CELEBRA-ME | Screenshot Tool — Registry & Configuration Validation
// =============================================================================

import type {
	CaptureTarget,
	GeneralSet,
	InvitationSet,
	PageType,
	ScreenshotConfig,
	ScreenshotConfigPage,
	ScreenshotMode,
	ViewportProfileType,
} from './types.js';
import { KNOWN_SECTIONS, VIEWPORT_PROFILES } from './types.js';

export const VALID_PAGE_TYPES: readonly PageType[] = [
	'invitation',
	'landing',
	'dashboard',
	'admin',
	'login',
	'custom',
];

export const VALID_TARGETS: readonly CaptureTarget[] = [
	'full-page',
	'critical-qa',
	'all-sections',
	'single-section',
	'reveal-only',
];

export const VALID_VIEWPORT_PROFILES: readonly ViewportProfileType[] = [
	'invitation',
	'site',
	'full',
	'single',
];

export const VALID_MODES: readonly ScreenshotMode[] = ['audit', 'raw'];
export const VALID_INVITATION_SETS: readonly InvitationSet[] = [
	'essential',
	'full-qa',
	'reveal-only',
	'full-page',
];
export const VALID_GENERAL_SETS: readonly GeneralSet[] = ['basic', 'full-qa'];
export const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp', 'pdf'] as const;
export const VALID_OUTPUT_FOLDER_STYLES = [
	'default',
	'timestamped',
	'custom',
	'overwrite',
] as const;
export const VALID_REVEAL_HANDLING = [
	'auto',
	'force-open',
	'closed-only',
	'open-only',
	'skip',
] as const;
export const VALID_ANIMATION_HANDLING = ['disable', 'wait', 'query-param', 'custom'] as const;
export const VALID_SECTION_CAPTURE = ['none', 'auto', 'known', 'custom', 'single'] as const;
export const VALID_SECTION_EXTENT = ['full', 'viewport'] as const;
export const VALID_AUTH_METHODS = [
	'none',
	'existing-session',
	'storage-state',
	'manual-login',
] as const;

const CONFIG_KEYS = new Set([
	'baseUrl',
	'outputDir',
	'defaultMode',
	'defaultViewportProfile',
	'defaultAnimationHandling',
	'defaultOutputFormat',
	'defaultOutputFolderStyle',
	'pages',
]);

const PAGE_KEYS = new Set([
	'name',
	'pageType',
	'route',
	'mode',
	'viewports',
	'profile',
	'target',
	'includeLayout',
	'invitationSet',
	'generalSet',
	'revealHandling',
	'animationHandling',
	'sectionCapture',
	'sections',
	'sectionExtent',
	'criticalSelectors',
	'waitSelectors',
	'hideSelectors',
	'authMethod',
	'outputFormat',
]);

const SAFE_ARTIFACT_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export class ScreenshotConfigurationError extends Error {
	readonly code: string;

	constructor(message: string, code = 'INVALID_SCREENSHOT_CONFIG') {
		super(message);
		this.name = 'ScreenshotConfigurationError';
		this.code = code;
	}
}

function fail(message: string, code?: string): never {
	throw new ScreenshotConfigurationError(message, code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string, allowEmpty = false): asserts value is string {
	if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
		fail(`${label} must be a non-empty string.`);
	}
}

function assertEnum<T extends string>(value: unknown, label: string, allowed: readonly T[]): void {
	if (value !== undefined && !allowed.includes(value as T)) {
		fail(`${label} "${String(value)}" is unsupported. Known values: ${allowed.join(', ')}.`);
	}
}

function assertStringArray(value: unknown, label: string): void {
	if (value === undefined) return;
	if (
		!Array.isArray(value) ||
		value.some((item) => typeof item !== 'string' || item.trim().length === 0)
	) {
		fail(`${label} must be an array of non-empty strings.`);
	}
}

function normalizePathname(pathname: string): string {
	const normalized = pathname.replace(/\\+/g, '/').replace(/\/+$/, '');
	return normalized || '/';
}

function configRouteKey(route: string, baseUrl: string): string {
	let parsed: URL;
	try {
		parsed = new URL(route, baseUrl);
	} catch {
		fail(`Invalid route or URL "${route}".`, 'INVALID_ROUTE');
	}
	if (!['http:', 'https:'].includes(parsed.protocol)) {
		fail(`Route "${route}" must use http or https.`, 'INVALID_ROUTE');
	}
	if (parsed.username || parsed.password) {
		fail(`Route "${route}" must not contain credentials.`, 'UNSAFE_ROUTE');
	}
	const query = Array.from(parsed.searchParams.entries())
		.filter(([key]) => !['screenshot', 'reveal', 'forceEnvelope'].includes(key))
		.sort(([aKey, aValue], [bKey, bValue]) =>
			aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
		)
		.map(([key, value]) => `${key}=${value}`)
		.join('&');
	return `${parsed.origin}${normalizePathname(parsed.pathname)}${query ? `?${query}` : ''}`;
}

function assertSafeBaseUrl(value: unknown, label: string): void {
	if (value === undefined) return;
	assertString(value, label);
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		fail(`${label} must be an absolute http(s) URL.`);
	}
	if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
		fail(`${label} must be an absolute http(s) URL without credentials.`, 'UNSAFE_BASE_URL');
	}
	if (parsed.search || parsed.hash) {
		fail(`${label} must not contain query parameters or a fragment.`, 'INVALID_BASE_URL');
	}
}

function assertSelectorConfigs(value: unknown, label: string): void {
	if (value === undefined) return;
	if (!Array.isArray(value)) fail(`${label} must be an array.`);
	const selectors = value as unknown[];
	const seenSelectors = new Set<string>();
	for (const [index, raw] of selectors.entries()) {
		if (!isRecord(raw)) fail(`${label}[${index}] must be an object.`);
		const selector = raw.selector;
		assertString(selector, `${label}[${index}].selector`);
		if (seenSelectors.has(selector)) {
			fail(`${label} contains duplicate selector "${selector}".`, 'DUPLICATE_SELECTOR');
		}
		seenSelectors.add(selector);
		if (typeof raw.required !== 'boolean') {
			fail(`${label}[${index}].required must be a boolean.`);
		}
		if (raw.capture !== undefined && typeof raw.capture !== 'boolean') {
			fail(`${label}[${index}].capture must be a boolean.`);
		}
		if (raw.label !== undefined) {
			assertString(raw.label, `${label}[${index}].label`);
			if (!SAFE_ARTIFACT_SEGMENT.test(raw.label)) {
				fail(
					`${label}[${index}].label must be a safe artifact name (letters, numbers, "-", "_").`,
					'UNSAFE_ARTIFACT_NAME',
				);
			}
		}
	}
}

function assertPageConfig(
	page: unknown,
	index: number,
	baseUrl: string,
): asserts page is ScreenshotConfigPage {
	if (!isRecord(page)) fail(`pages[${index}] must be an object.`);
	for (const key of Object.keys(page)) {
		if (!PAGE_KEYS.has(key)) fail(`pages[${index}] contains unsupported property "${key}".`);
	}
	assertString(page.name, `pages[${index}].name`);
	assertString(page.route, `pages[${index}].route`);
	if (page.pageType === undefined) fail(`pages[${index}].pageType is required.`);
	assertEnum(page.pageType, `pages[${index}].pageType`, VALID_PAGE_TYPES);
	assertEnum(page.mode, `pages[${index}].mode`, VALID_MODES);
	assertEnum(page.profile, `pages[${index}].profile`, VALID_VIEWPORT_PROFILES);
	assertEnum(page.target, `pages[${index}].target`, VALID_TARGETS);
	assertEnum(page.invitationSet, `pages[${index}].invitationSet`, VALID_INVITATION_SETS);
	assertEnum(page.generalSet, `pages[${index}].generalSet`, VALID_GENERAL_SETS);
	assertEnum(page.revealHandling, `pages[${index}].revealHandling`, VALID_REVEAL_HANDLING);
	assertEnum(
		page.animationHandling,
		`pages[${index}].animationHandling`,
		VALID_ANIMATION_HANDLING,
	);
	assertEnum(page.sectionCapture, `pages[${index}].sectionCapture`, VALID_SECTION_CAPTURE);
	assertEnum(page.sectionExtent, `pages[${index}].sectionExtent`, VALID_SECTION_EXTENT);
	assertEnum(page.authMethod, `pages[${index}].authMethod`, VALID_AUTH_METHODS);
	assertEnum(page.outputFormat, `pages[${index}].outputFormat`, VALID_OUTPUT_FORMATS);
	if (page.includeLayout !== undefined && typeof page.includeLayout !== 'boolean') {
		fail(`pages[${index}].includeLayout must be a boolean.`);
	}
	assertStringArray(page.viewports, `pages[${index}].viewports`);
	assertStringArray(page.sections, `pages[${index}].sections`);
	if (Array.isArray(page.sections)) {
		const normalized = page.sections.map((section) => section.trim());
		if (new Set(normalized).size !== normalized.length) {
			fail(`pages[${index}].sections must not contain duplicates.`, 'DUPLICATE_SECTION');
		}
	}
	if (Array.isArray(page.viewports)) {
		const normalized = page.viewports.map((viewport) => viewport.trim());
		if (new Set(normalized).size !== normalized.length) {
			fail(`pages[${index}].viewports must not contain duplicates.`, 'DUPLICATE_VIEWPORT');
		}
		for (const viewport of normalized) {
			const canonical = viewport === 'mobile-small' ? 'mobile-narrow' : viewport;
			const supported = Object.values(VIEWPORT_PROFILES).some((profile) =>
				profile.viewports.some((entry) => entry.name === canonical),
			);
			if (!supported)
				fail(
					`pages[${index}] uses unsupported viewport "${viewport}".`,
					'UNKNOWN_VIEWPORT',
				);
		}
	}
	if (
		page.profile === 'single' &&
		(!Array.isArray(page.viewports) || page.viewports.length === 0)
	) {
		fail(
			`pages[${index}].profile "single" requires an explicit viewports array.`,
			'EMPTY_VIEWPORT_SELECTION',
		);
	}
	assertSelectorConfigs(page.criticalSelectors, `pages[${index}].criticalSelectors`);
	assertStringArray(page.waitSelectors, `pages[${index}].waitSelectors`);
	assertStringArray(page.hideSelectors, `pages[${index}].hideSelectors`);
	configRouteKey(page.route, baseUrl);
}

/** Validate the static screenshot registry shared by all invitation types. */
export function assertScreenshotRegistryIntegrity(): void {
	const globalViewports = new Map<string, string>();
	for (const [profileName, profile] of Object.entries(VIEWPORT_PROFILES)) {
		if (profile.name !== profileName) {
			fail(
				`Viewport profile "${profileName}" has mismatched identity.`,
				'INVALID_VIEWPORT_PROFILE',
			);
		}
		const seen = new Set<string>();
		for (const viewport of profile.viewports) {
			if (seen.has(viewport.name)) {
				fail(
					`Viewport profile "${profileName}" contains duplicate viewport "${viewport.name}".`,
					'DUPLICATE_VIEWPORT',
				);
			}
			seen.add(viewport.name);
			if (!(viewport.width > 0 && viewport.height > 0 && viewport.deviceScaleFactor > 0)) {
				fail(`Viewport "${viewport.name}" has invalid dimensions.`, 'INVALID_VIEWPORT');
			}
			const shape = JSON.stringify([
				viewport.width,
				viewport.height,
				viewport.deviceScaleFactor,
			]);
			const prior = globalViewports.get(viewport.name);
			if (prior && prior !== shape) {
				fail(
					`Viewport "${viewport.name}" has conflicting definitions.`,
					'CONFLICTING_VIEWPORT',
				);
			}
			globalViewports.set(viewport.name, shape);
		}
	}

	for (const pageType of VALID_PAGE_TYPES) {
		const ids = new Set<string>();
		const outputSlugs = new Set<string>();
		for (const section of KNOWN_SECTIONS.filter((entry) => entry.pageType === pageType)) {
			assertString(section.id, `Section id for ${pageType}`);
			assertString(section.outputSlug, `Section outputSlug for ${pageType}`);
			assertString(section.selector, `Section selector for ${pageType}`);
			if (
				!SAFE_ARTIFACT_SEGMENT.test(section.id) ||
				!SAFE_ARTIFACT_SEGMENT.test(section.outputSlug)
			) {
				fail(
					`Section "${section.id}" for ${pageType} has an unsafe artifact identity.`,
					'UNSAFE_ARTIFACT_NAME',
				);
			}
			if (ids.has(section.id))
				fail(`Duplicate section id "${section.id}" for ${pageType}.`, 'DUPLICATE_SECTION');
			if (outputSlugs.has(section.outputSlug))
				fail(
					`Duplicate section outputSlug "${section.outputSlug}" for ${pageType}.`,
					'DUPLICATE_ARTIFACT',
				);
			ids.add(section.id);
			outputSlugs.add(section.outputSlug);
			const fallbackSelectors = section.fallbackSelectors ?? [];
			if (new Set(fallbackSelectors).size !== fallbackSelectors.length) {
				fail(
					`Section "${section.id}" has duplicate fallback selectors.`,
					'DUPLICATE_SELECTOR',
				);
			}
		}
	}
}

/** Validate a JSON config before any browser or filesystem capture work starts. */
export function validateScreenshotConfig(
	value: unknown,
	configPath = 'screenshot.config.json',
): ScreenshotConfig {
	assertScreenshotRegistryIntegrity();
	if (!isRecord(value)) fail(`Screenshot config must be a JSON object: ${configPath}`);
	for (const key of Object.keys(value)) {
		if (!CONFIG_KEYS.has(key))
			fail(`Screenshot config contains unsupported property "${key}".`);
	}
	assertSafeBaseUrl(value.baseUrl, 'baseUrl');
	if (value.outputDir !== undefined) assertString(value.outputDir, 'outputDir');
	assertEnum(value.defaultMode, 'defaultMode', VALID_MODES);
	assertEnum(value.defaultViewportProfile, 'defaultViewportProfile', VALID_VIEWPORT_PROFILES);
	assertEnum(
		value.defaultAnimationHandling,
		'defaultAnimationHandling',
		VALID_ANIMATION_HANDLING,
	);
	assertEnum(value.defaultOutputFormat, 'defaultOutputFormat', VALID_OUTPUT_FORMATS);
	assertEnum(
		value.defaultOutputFolderStyle,
		'defaultOutputFolderStyle',
		VALID_OUTPUT_FOLDER_STYLES,
	);
	if (!Array.isArray(value.pages) || value.pages.length === 0) {
		fail(`Screenshot config must contain at least one page: ${configPath}`, 'EMPTY_CONFIG');
	}
	const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl : 'http://localhost:4321';
	const names = new Set<string>();
	const routes = new Set<string>();
	for (const [index, page] of value.pages.entries()) {
		assertPageConfig(page, index, baseUrl);
		const name = page.name.toLowerCase();
		if (names.has(name))
			fail(`Duplicate screenshot config page name "${page.name}".`, 'DUPLICATE_PAGE');
		names.add(name);
		const routeKey = configRouteKey(page.route, baseUrl);
		if (routes.has(routeKey))
			fail(`Duplicate screenshot config route "${page.route}".`, 'DUPLICATE_ROUTE');
		routes.add(routeKey);
	}
	return value as ScreenshotConfig;
}

export function isSafeScreenshotArtifactSegment(value: string): boolean {
	return SAFE_ARTIFACT_SEGMENT.test(value);
}

export interface InvitationCatalogEntry {
	route: string;
	slug: string;
	eventType: string;
	name: string;
}

/** Validate every discovered demo/template/managed invitation before selection. */
export function assertInvitationCatalogIntegrity(entries: readonly InvitationCatalogEntry[]): void {
	const routes = new Set<string>();
	const identities = new Set<string>();
	for (const entry of entries) {
		assertString(entry.name, 'Invitation catalog name');
		assertString(entry.route, `Invitation route for "${entry.name}"`);
		assertString(entry.eventType, `Invitation eventType for "${entry.name}"`);
		assertString(entry.slug, `Invitation slug for "${entry.name}"`);
		if (
			!SAFE_ARTIFACT_SEGMENT.test(entry.eventType) ||
			!SAFE_ARTIFACT_SEGMENT.test(entry.slug)
		) {
			fail(
				`Invitation "${entry.name}" has an unsafe route identity.`,
				'INVALID_ROUTE_IDENTITY',
			);
		}
		const routeKey = configRouteKey(entry.route, 'http://localhost:4321');
		const identity = `${entry.eventType.toLowerCase()}/${entry.slug.toLowerCase()}`;
		if (routes.has(routeKey))
			fail(`Duplicate invitation route "${entry.route}".`, 'DUPLICATE_ROUTE');
		if (identities.has(identity))
			fail(`Duplicate invitation identity "${identity}".`, 'DUPLICATE_IDENTITY');
		routes.add(routeKey);
		identities.add(identity);
		if (routeKey !== `http://localhost:4321/${entry.eventType}/${entry.slug}`) {
			fail(
				`Invitation registry identity does not match route "${entry.route}".`,
				'IDENTITY_MISMATCH',
			);
		}
	}
}
