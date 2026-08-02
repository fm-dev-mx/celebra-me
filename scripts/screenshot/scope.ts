// =============================================================================
// CELEBRA-ME | Screenshot Tool — Canonical Scope Resolver
// =============================================================================

import * as path from 'node:path';
import {
	type AuthMethod,
	type CaptureTarget,
	type GeneralSet,
	type InvitationSet,
	type PageType,
	type ScreenshotJob,
	type ScreenshotMode,
	type SectionCapture,
	type SectionExtent,
	type Viewport,
	type ViewportProfileType,
	KNOWN_SECTIONS,
	VIEWPORT_PROFILES,
} from './types.js';
import {
	createPageSlug,
	findViewportByName,
	formatExtension,
	getDefaultCriticalSelectors,
	getDefaultProfile,
	resolveOutputDir,
} from './utils.js';

export type ScopeSource = 'direct' | 'config' | 'interactive' | 'corpus';
export type ScopePreset = 'all-sections' | 'critical-qa';

export interface RouteIdentity {
	pathname: string;
	query: string;
	key: string;
}

export interface ResolvedSectionSelection {
	kind: 'ids' | 'preset';
	ids: string[];
	preset?: ScopePreset;
}

export interface ResolvedScopeTask {
	id: string;
	label: string;
	viewportName: string;
	outputPath: string;
	required: boolean;
	sectionId?: string;
}

export interface ResolvedInvitationScope {
	route: string;
	url: string;
	pageType: PageType;
	routeIdentity: RouteIdentity;
	eventType?: string;
	slug?: string;
	target: CaptureTarget;
	sectionSelection: ResolvedSectionSelection;
	includeLayout: boolean;
	viewportProfile: ViewportProfileType;
	viewports: Viewport[];
	outputDir: string;
	tasks: ResolvedScopeTask[];
	cleanupTargets: string[];
}

export interface ResolvedScreenshotPlan {
	version: 1;
	source: ScopeSource;
	sourceRequest: Record<string, unknown>;
	pageType: PageType;
	invitations: ResolvedInvitationScope[];
	viewports: Viewport[];
	tasks: ResolvedScopeTask[];
	cleanupTargets: string[];
	clean: boolean;
}

export interface ScopeRouteCatalog {
	/** Canonical invitation routes. General page routes do not belong here. */
	invitationRoutes: readonly string[];
}

export interface ScreenshotScopeRequest {
	source: ScopeSource;
	pageType?: PageType;
	baseUrl: string;
	routes: string[];
	mode?: ScreenshotMode;
	profile?: ViewportProfileType;
	viewports?: string[];
	target?: CaptureTarget;
	invitationSet?: InvitationSet;
	generalSet?: GeneralSet;
	sectionCapture?: SectionCapture;
	sections?: string | string[];
	includeLayout?: boolean;
	revealHandling?: ScreenshotJob['revealHandling'];
	animationHandling?: ScreenshotJob['animationHandling'];
	sectionExtent?: SectionExtent;
	criticalSelectors?: ScreenshotJob['criticalSelectors'];
	waitSelectors?: string[];
	hideSelectors?: string[];
	authMethod?: AuthMethod;
	outputFormat?: ScreenshotJob['outputFormat'];
	outputFolderStyle?: ScreenshotJob['outputFolderStyle'];
	outputFolder?: string;
	clean?: boolean;
	/** User-selected options that are disallowed with corpus mode. */
	targetedOptions?: string[];
}

export class ScreenshotScopeError extends Error {
	readonly code: string;

	constructor(message: string, code = 'SCREENSHOT_SCOPE_INVALID') {
		super(message);
		this.name = 'ScreenshotScopeError';
		this.code = code;
	}
}

const VALID_PAGE_TYPES: readonly PageType[] = [
	'invitation',
	'landing',
	'dashboard',
	'admin',
	'login',
	'custom',
];

const VALID_TARGETS: readonly CaptureTarget[] = [
	'full-page',
	'critical-qa',
	'all-sections',
	'single-section',
	'reveal-only',
];

const REVEAL_ONLY_TARGET: CaptureTarget = 'reveal-only';

function stableUnique(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		const normalized = value.trim();
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(normalized);
	}
	return result;
}

function flattenCommaValues(values: string | string[] | undefined): string[] {
	if (!values) return [];
	return stableUnique(
		(Array.isArray(values) ? values : [values]).flatMap((value) => value.split(',')),
	);
}

function normalizePathname(pathname: string): string {
	const normalized = pathname.replace(/\/+/g, '/').replace(/\/+$/, '');
	return normalized || '/';
}

function relevantQueryEntries(url: URL): string[] {
	const ignored = new Set(['screenshot', 'reveal', 'forceEnvelope']);
	return Array.from(url.searchParams.entries())
		.filter(
			([key]) =>
				!ignored.has(key) &&
				!/^utm_/i.test(key) &&
				!['gclid', 'fbclid'].includes(key.toLowerCase()),
		)
		.sort(([aKey, aValue], [bKey, bValue]) =>
			aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
		)
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

export function normalizeRouteIdentity(
	input: string,
	baseUrl = 'http://localhost:4321',
): RouteIdentity {
	let parsed: URL;
	try {
		parsed = new URL(input, baseUrl);
	} catch {
		throw new ScreenshotScopeError(
			`Invalid screenshot route or URL: "${input}".`,
			'INVALID_ROUTE',
		);
	}
	const query = relevantQueryEntries(parsed).join('&');
	const pathname = normalizePathname(parsed.pathname);
	return { pathname, query, key: query ? `${pathname}?${query}` : pathname };
}

function routeParts(identity: RouteIdentity): { eventType: string; slug: string } | null {
	const parts = identity.pathname.split('/').filter(Boolean);
	if (parts.length !== 2) return null;
	return { eventType: parts[0], slug: parts[1] };
}

function routeCatalogKeys(catalog: ScopeRouteCatalog): Set<string> {
	return new Set(catalog.invitationRoutes.map((route) => normalizeRouteIdentity(route).key));
}

function validateRoute(
	route: string,
	pageType: PageType,
	baseUrl: string,
	catalog: ScopeRouteCatalog,
): { identity: RouteIdentity; eventType?: string; slug?: string } {
	const identity = normalizeRouteIdentity(route, baseUrl);
	if (pageType !== 'invitation') return { identity };

	const parts = routeParts(identity);
	if (!parts) {
		throw new ScreenshotScopeError(
			`Invitation route must be /<eventType>/<slug>: "${route}".`,
			'INVALID_INVITATION_ROUTE',
		);
	}
	if (!routeCatalogKeys(catalog).has(identity.key)) {
		throw new ScreenshotScopeError(
			`Unknown invitation route "${identity.key}". Choose a discovered or corpus invitation.`,
			'UNKNOWN_INVITATION_ROUTE',
		);
	}
	return { identity, eventType: parts.eventType, slug: parts.slug };
}

function mapLegacyTarget(request: ScreenshotScopeRequest): CaptureTarget | undefined {
	const legacy = request.pageType === 'invitation' ? request.invitationSet : request.generalSet;
	if (!legacy) return undefined;
	if (request.pageType === 'invitation') {
		switch (legacy) {
			case 'essential':
				return 'critical-qa';
			case 'full-qa':
				return 'critical-qa';
			case 'reveal-only':
				return REVEAL_ONLY_TARGET;
			case 'full-page':
				return 'full-page';
		}
	}
	return legacy === 'full-qa' ? 'critical-qa' : 'full-page';
}

function resolveTarget(request: ScreenshotScopeRequest): CaptureTarget {
	if (request.target && !VALID_TARGETS.includes(request.target)) {
		throw new ScreenshotScopeError(
			`Unknown screenshot target "${request.target}".`,
			'INVALID_TARGET',
		);
	}
	const legacyTarget = mapLegacyTarget(request);
	if (request.target && legacyTarget && request.target !== legacyTarget) {
		throw new ScreenshotScopeError(
			`Ambiguous scope: target "${request.target}" conflicts with the selected legacy set. Use one explicit target.`,
			'AMBIGUOUS_TARGET',
		);
	}
	if (request.target) return request.target;
	if (legacyTarget) return legacyTarget;
	if (request.sections && flattenCommaValues(request.sections).length > 0)
		return 'single-section';
	if (request.sectionCapture === 'known' || request.sectionCapture === 'auto')
		return 'all-sections';
	return 'critical-qa';
}

function resolveViewportsStrict(
	pageType: PageType,
	profile: ViewportProfileType | undefined,
	viewportNames: string[] | undefined,
): { profile: ViewportProfileType; viewports: Viewport[] } {
	const resolvedProfile = profile ?? getDefaultProfile(pageType);
	if (!Object.prototype.hasOwnProperty.call(VIEWPORT_PROFILES, resolvedProfile)) {
		throw new ScreenshotScopeError(
			`Unknown viewport profile "${resolvedProfile}". Known profiles: ${Object.keys(VIEWPORT_PROFILES).join(', ')}.`,
			'INVALID_VIEWPORT_PROFILE',
		);
	}

	const names = flattenCommaValues(viewportNames);
	if (names.length === 0) {
		if (resolvedProfile === 'single') {
			throw new ScreenshotScopeError(
				'Viewport profile "single" requires an explicit --viewport value.',
				'EMPTY_VIEWPORT_SELECTION',
			);
		}
		return {
			profile: resolvedProfile,
			viewports: [...VIEWPORT_PROFILES[resolvedProfile].viewports],
		};
	}

	const viewports: Viewport[] = [];
	for (const name of names) {
		const found = findViewportByName(name);
		if (!found) {
			throw new ScreenshotScopeError(
				`Unknown viewport "${name}". Known names: mobile-narrow, mobile-standard, mobile-large, tablet, desktop.`,
				'UNKNOWN_VIEWPORT',
			);
		}
		if (!viewports.some((viewport) => viewport.name === found.name)) viewports.push(found);
	}
	return { profile: viewports.length === 1 ? 'single' : resolvedProfile, viewports };
}

function resolveSections(
	pageType: PageType,
	target: CaptureTarget,
	request: ScreenshotScopeRequest,
): ResolvedSectionSelection {
	const selected = flattenCommaValues(request.sections);
	const pageSections = KNOWN_SECTIONS.filter((section) => section.pageType === pageType);
	const byId = new Map<string, (typeof pageSections)[number]>();
	for (const section of pageSections) {
		if (byId.has(section.id)) {
			throw new ScreenshotScopeError(
				`Section id "${section.id}" is ambiguous for page type "${pageType}".`,
				'AMBIGUOUS_SECTION',
			);
		}
		byId.set(section.id, section);
	}

	if (request.sectionCapture === 'custom') {
		throw new ScreenshotScopeError(
			'Custom section selectors are not part of the strict scope pipeline. Use --sections=<registered-id>.',
			'UNSUPPORTED_SECTION_SELECTORS',
		);
	}

	const presetToken =
		selected.length === 1 && ['known', 'auto', 'all-sections'].includes(selected[0]);
	if (presetToken) {
		if (target !== 'all-sections' && target !== 'critical-qa') {
			throw new ScreenshotScopeError(
				`Section preset "${selected[0]}" is incompatible with target "${target}".`,
				'INCOMPATIBLE_SECTION_SELECTION',
			);
		}
		return { kind: 'preset', ids: [], preset: 'all-sections' };
	}

	if (selected.length > 0) {
		if (target !== 'single-section') {
			throw new ScreenshotScopeError(
				`Explicit sections require target "single-section"; received "${target}".`,
				'INCOMPATIBLE_SECTION_SELECTION',
			);
		}
		const ids = stableUnique(selected);
		for (const id of ids) {
			if (!byId.has(id)) {
				throw new ScreenshotScopeError(
					`Unknown section "${id}" for page type "${pageType}".`,
					'UNKNOWN_SECTION',
				);
			}
		}
		return { kind: 'ids', ids };
	}
	if (request.invitationSet === 'essential' && target === 'critical-qa') {
		return { kind: 'ids', ids: [] };
	}

	if (target === 'single-section') {
		throw new ScreenshotScopeError(
			'An explicit section is required for target "single-section".',
			'EMPTY_SECTION_SELECTION',
		);
	}
	if (target === 'all-sections' || (target === 'critical-qa' && pageType === 'invitation')) {
		return {
			kind: 'preset',
			ids: [],
			preset: target === 'all-sections' ? 'all-sections' : 'critical-qa',
		};
	}
	return { kind: 'ids', ids: [] };
}

function assertCorpusCompatibility(request: ScreenshotScopeRequest): void {
	if (request.source !== 'corpus') return;
	const targeted = stableUnique(request.targetedOptions ?? []);
	if (targeted.length > 0) {
		throw new ScreenshotScopeError(
			`Corpus mode cannot be combined with targeted options: ${targeted.join(', ')}. Run one invitation without --corpus.`,
			'CORPUS_TARGET_CONFLICT',
		);
	}
}

function assertRequestValues(request: ScreenshotScopeRequest): void {
	const checks: Array<[string, unknown, readonly string[]]> = [
		['mode', request.mode, ['audit', 'raw']],
		[
			'reveal handling',
			request.revealHandling,
			['auto', 'force-open', 'closed-only', 'open-only', 'skip'],
		],
		[
			'animation handling',
			request.animationHandling,
			['disable', 'wait', 'query-param', 'custom'],
		],
		['section extent', request.sectionExtent, ['full', 'viewport']],
		['section capture', request.sectionCapture, ['none', 'auto', 'known', 'custom', 'single']],
		[
			'auth method',
			request.authMethod,
			['none', 'existing-session', 'storage-state', 'manual-login'],
		],
		['output format', request.outputFormat, ['png', 'jpeg', 'webp', 'pdf']],
		[
			'output folder style',
			request.outputFolderStyle,
			['default', 'timestamped', 'custom', 'overwrite'],
		],
	];
	for (const [label, value, allowed] of checks) {
		if (value !== undefined && !allowed.includes(String(value))) {
			throw new ScreenshotScopeError(
				`Invalid ${label} "${String(value)}". Known values: ${allowed.join(', ')}.`,
				'INVALID_SCOPE_VALUE',
			);
		}
	}
	if (request.includeLayout !== undefined && typeof request.includeLayout !== 'boolean') {
		throw new ScreenshotScopeError('includeLayout must be a boolean.', 'INVALID_SCOPE_VALUE');
	}
}

function taskDefinitions(
	pageType: PageType,
	target: CaptureTarget,
	sectionSelection: ResolvedSectionSelection,
	includeLayout: boolean,
): Array<{ id: string; label: string; required: boolean; sectionId?: string }> {
	if (pageType === 'invitation') {
		const tasks: Array<{ id: string; label: string; required: boolean; sectionId?: string }> =
			[];
		if (target === 'full-page' || target === 'critical-qa') {
			tasks.push({
				id: '01-initial-closed-viewport',
				label: 'Initial cover (closed)',
				required: true,
			});
			if (target === 'critical-qa') {
				tasks.push({
					id: '02-reveal-closed',
					label: 'Reveal section (closed)',
					required: false,
				});
				tasks.push({
					id: '03-reveal-letter-open',
					label: 'Reveal letter (open)',
					required: false,
				});
				tasks.push({
					id: '04-reveal-transition-open',
					label: 'Reveal transition (open)',
					required: false,
				});
			}
			tasks.push({
				id: '05-invitation-full-page',
				label: 'Full invitation (open)',
				required: true,
			});
		}
		if (target === REVEAL_ONLY_TARGET) {
			tasks.push({
				id: '02-reveal-closed',
				label: 'Reveal section (closed)',
				required: true,
			});
			tasks.push({
				id: '03-reveal-letter-open',
				label: 'Reveal letter (open)',
				required: false,
			});
			tasks.push({
				id: '04-reveal-transition-open',
				label: 'Reveal transition (open)',
				required: false,
			});
		}
		if (target === 'single-section') {
			for (const id of sectionSelection.ids) {
				const section = KNOWN_SECTIONS.find(
					(item) => item.pageType === pageType && item.id === id,
				);
				if (!section) continue;
				tasks.push({
					id: `06-section-${section.outputSlug}`,
					label: `Section: ${section.label}`,
					required: true,
					sectionId: section.id,
				});
			}
		}
		return tasks;
	}

	const tasks: Array<{ id: string; label: string; required: boolean; sectionId?: string }> = [];
	if (includeLayout) tasks.push({ id: '01-viewport', label: 'Viewport', required: true });
	if (target === 'full-page' || target === 'critical-qa') {
		tasks.push({ id: '02-full-page', label: 'Full page', required: true });
	}
	if (target === 'single-section') {
		for (const id of sectionSelection.ids) {
			const section = KNOWN_SECTIONS.find(
				(item) => item.pageType === pageType && item.id === id,
			);
			if (!section) continue;
			tasks.push({
				id: `06-section-${section.outputSlug}`,
				label: `Section: ${section.label}`,
				required: true,
				sectionId: section.id,
			});
		}
	}
	return tasks;
}

function buildTasks(
	outputDir: string,
	viewports: Viewport[],
	definitions: Array<{ id: string; label: string; required: boolean; sectionId?: string }>,
	outputFormat: ScreenshotJob['outputFormat'],
): ResolvedScopeTask[] {
	const extension = formatExtension(outputFormat);
	return viewports.flatMap((viewport) =>
		definitions.map((definition) => ({
			...definition,
			viewportName: viewport.name,
			outputPath: path.join(outputDir, viewport.name, `${definition.id}.${extension}`),
		})),
	);
}

function validateOutputFolder(outputDir: string, cleanupTargets: readonly string[]): void {
	const root = path.resolve(outputDir);
	if (path.parse(root).root === root) {
		throw new ScreenshotScopeError(
			`Unsafe screenshot output path "${outputDir}".`,
			'UNSAFE_OUTPUT_PATH',
		);
	}
	for (const target of cleanupTargets) {
		const resolvedTarget = path.resolve(target);
		const relative = path.relative(root, resolvedTarget);
		if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
			throw new ScreenshotScopeError(
				`Cleanup target is outside the resolved output scope: "${target}".`,
				'UNSAFE_CLEANUP_TARGET',
			);
		}
	}
}

export function validateResolvedCleanupTargets(plan: ResolvedScreenshotPlan): void {
	for (const invitation of plan.invitations) {
		validateOutputFolder(invitation.outputDir, invitation.cleanupTargets);
	}
}

// eslint-disable-next-line complexity -- Scope validation intentionally centralizes incompatible selections.
function resolveInvitationScope(
	request: ScreenshotScopeRequest,
	route: string,
	catalog: ScopeRouteCatalog,
): ResolvedInvitationScope {
	const pageType = request.pageType ?? 'custom';
	if (!VALID_PAGE_TYPES.includes(pageType)) {
		throw new ScreenshotScopeError(`Unknown page type "${pageType}".`, 'INVALID_PAGE_TYPE');
	}
	const routeDetails = validateRoute(route, pageType, request.baseUrl, catalog);
	const target = resolveTarget(request);
	const sectionSelection = resolveSections(pageType, target, request);
	if (pageType !== 'invitation' && request.invitationSet) {
		throw new ScreenshotScopeError(
			'Invitation sets require page type "invitation".',
			'INVALID_SET',
		);
	}
	if (pageType === 'invitation' && request.generalSet) {
		throw new ScreenshotScopeError(
			'General page sets cannot target an invitation.',
			'INVALID_SET',
		);
	}
	if (target === 'reveal-only' && pageType !== 'invitation') {
		throw new ScreenshotScopeError(
			'Target "reveal-only" requires page type "invitation".',
			'INVALID_TARGET',
		);
	}
	if (request.authMethod === 'existing-session' || request.authMethod === 'manual-login') {
		throw new ScreenshotScopeError(
			`Authentication method "${request.authMethod}" is not supported by the deterministic headless runner. Use --auth=storage-state or --auth=none.`,
			'UNSUPPORTED_AUTH_METHOD',
		);
	}
	if (
		target === 'full-page' &&
		pageType === 'invitation' &&
		['closed-only', 'skip'].includes(request.revealHandling ?? 'auto')
	) {
		throw new ScreenshotScopeError(
			'Invitation full-page capture requires an open-state artifact; do not combine it with closed-only or skip reveal handling.',
			'INCOMPATIBLE_REVEAL_MODE',
		);
	}
	const viewportResolution = resolveViewportsStrict(pageType, request.profile, request.viewports);
	if (request.outputFolderStyle === 'custom' && !request.outputFolder) {
		throw new ScreenshotScopeError(
			'Output style "custom" requires an explicit output folder.',
			'INVALID_OUTPUT_SCOPE',
		);
	}
	const outputDir =
		request.outputFolder ??
		resolveOutputDir(
			createPageSlug(route),
			request.outputFolderStyle ?? 'default',
			request.outputFolder,
		);
	const includeLayout =
		request.includeLayout ?? (target === 'critical-qa' && pageType !== 'invitation');
	const definitions = taskDefinitions(pageType, target, sectionSelection, includeLayout);
	const tasks = buildTasks(
		outputDir,
		viewportResolution.viewports,
		definitions,
		request.outputFormat ?? 'png',
	);
	const legacyCleanupPaths =
		pageType === 'invitation' && (target === 'full-page' || target === 'critical-qa')
			? viewportResolution.viewports.map((viewport) =>
					path.join(
						outputDir,
						viewport.name,
						`05-invitation-full-open.${formatExtension(request.outputFormat ?? 'png')}`,
					),
				)
			: [];
	const presetCleanupPaths =
		sectionSelection.kind === 'preset' && sectionSelection.preset
			? KNOWN_SECTIONS.filter((section) => section.pageType === pageType).map(
					(section, index) => {
						// Match runtime task ids: invitation sections use `10-XX-<slug>`,
						// general pages use `06-section-<slug>` (see capture-plan).
						const prefix =
							pageType === 'invitation'
								? `10-${String(index + 1).padStart(2, '0')}`
								: '06-section';
						return path.join(
							outputDir,
							'{viewport}',
							`${prefix}-${section.outputSlug}.${formatExtension(request.outputFormat ?? 'png')}`,
						);
					},
				)
			: [];
	const cleanupTargets = stableUnique([
		...tasks.map((task) => task.outputPath),
		...legacyCleanupPaths,
		...presetCleanupPaths.flatMap((pattern) =>
			viewportResolution.viewports.map((viewport) =>
				pattern.replace('{viewport}', viewport.name),
			),
		),
		path.join(outputDir, 'preflight.json'),
		path.join(outputDir, 'report.json'),
	]);
	validateOutputFolder(outputDir, cleanupTargets);
	return {
		route,
		url: new URL(route, request.baseUrl).toString(),
		pageType,
		routeIdentity: routeDetails.identity,
		eventType: routeDetails.eventType,
		slug: routeDetails.slug,
		target,
		sectionSelection,
		includeLayout,
		viewportProfile: viewportResolution.profile,
		viewports: viewportResolution.viewports,
		outputDir,
		tasks,
		cleanupTargets,
	};
}

export function resolveScreenshotPlan(
	request: ScreenshotScopeRequest,
	catalog: ScopeRouteCatalog,
): ResolvedScreenshotPlan {
	assertRequestValues(request);
	assertCorpusCompatibility(request);
	if (request.routes.length === 0) {
		throw new ScreenshotScopeError(
			'Screenshot scope must contain at least one route.',
			'EMPTY_SCOPE',
		);
	}
	const invitations = request.routes.map((route) =>
		resolveInvitationScope(request, route, catalog),
	);
	const first = invitations[0];
	return {
		version: 1,
		source: request.source,
		sourceRequest: { ...request },
		pageType: first.pageType,
		invitations,
		viewports: first.viewports,
		tasks: invitations.flatMap((invitation) => invitation.tasks),
		cleanupTargets: invitations.flatMap((invitation) => invitation.cleanupTargets),
		clean: request.clean === true,
	};
}

export function resolveScreenshotJobScope(
	job: ScreenshotJob,
	source: ScopeSource,
	catalog: ScopeRouteCatalog,
	clean = false,
): { job: ScreenshotJob; plan: ResolvedScreenshotPlan } {
	const plan = resolveScreenshotPlan(
		{
			source,
			pageType: job.pageType,
			baseUrl: job.baseUrl,
			routes: [job.url],
			mode: job.mode,
			profile: job.viewportProfile,
			viewports: job.viewports.map((viewport) => viewport.name),
			target: job.target,
			invitationSet: job.invitationSet,
			generalSet: job.generalSet,
			sectionCapture: job.sectionCapture,
			sections: job.selectedSections ?? job.selectedSection,
			includeLayout: job.includeLayout,
			revealHandling: job.revealHandling,
			animationHandling: job.animationHandling,
			sectionExtent: job.sectionExtent,
			criticalSelectors: job.criticalSelectors,
			waitSelectors: job.waitSelectors,
			hideSelectors: job.hideSelectors,
			authMethod: job.authMethod,
			outputFormat: job.outputFormat,
			outputFolderStyle: job.outputFolderStyle,
			outputFolder: job.outputFolder,
			clean,
		},
		catalog,
	);
	const resolved = plan.invitations[0];
	const materialized: ScreenshotJob = {
		...job,
		url: resolved.url,
		viewportProfile: resolved.viewportProfile,
		viewports: resolved.viewports,
		target: resolved.target,
		selectedSections:
			resolved.sectionSelection.kind === 'ids' ? resolved.sectionSelection.ids : undefined,
		selectedSection:
			resolved.sectionSelection.kind === 'ids' ? resolved.sectionSelection.ids[0] : undefined,
		sectionCapture: resolved.sectionSelection.kind === 'preset' ? 'known' : 'single',
		includeLayout: resolved.includeLayout,
		scope: plan,
	};
	return { job: materialized, plan };
}

export function buildJobFromResolvedInvitation(
	plan: ResolvedScreenshotPlan,
	invitation: ResolvedInvitationScope,
	request: Pick<
		ScreenshotScopeRequest,
		| 'mode'
		| 'animationHandling'
		| 'sectionExtent'
		| 'includeLayout'
		| 'criticalSelectors'
		| 'waitSelectors'
		| 'hideSelectors'
		| 'authMethod'
		| 'outputFormat'
		| 'outputFolderStyle'
	>,
): ScreenshotJob {
	return {
		pageType: invitation.pageType,
		mode: request.mode ?? 'audit',
		url: invitation.url,
		baseUrl: new URL(invitation.url).origin,
		viewportProfile: invitation.viewportProfile,
		viewports: invitation.viewports,
		target: invitation.target,
		includeLayout: invitation.includeLayout,
		revealHandling:
			(request as { revealHandling?: ScreenshotJob['revealHandling'] }).revealHandling ??
			'auto',
		animationHandling: request.animationHandling ?? 'disable',
		sectionCapture: invitation.sectionSelection.kind === 'preset' ? 'known' : 'single',
		sectionExtent: request.sectionExtent ?? 'full',
		selectedSections:
			invitation.sectionSelection.kind === 'ids'
				? invitation.sectionSelection.ids
				: undefined,
		selectedSection:
			invitation.sectionSelection.kind === 'ids'
				? invitation.sectionSelection.ids[0]
				: undefined,
		criticalSelectors:
			request.criticalSelectors ?? getDefaultCriticalSelectors(invitation.pageType),
		waitSelectors: request.waitSelectors ?? [],
		hideSelectors: request.hideSelectors ?? [],
		authMethod: request.authMethod ?? 'none',
		outputFormat: request.outputFormat ?? 'png',
		outputFolderStyle: request.outputFolderStyle ?? 'default',
		outputFolder: invitation.outputDir,
		scope: plan,
	};
}

function getResolvedInvitationScope(job: ScreenshotJob): ResolvedInvitationScope | undefined {
	return (
		job.scope?.invitations.find((invitation) => invitation.url === job.url) ??
		job.scope?.invitations[0]
	);
}

export function getResolvedSectionIds(job: ScreenshotJob): string[] {
	const invitation = getResolvedInvitationScope(job);
	return invitation?.sectionSelection.kind === 'ids' ? [...invitation.sectionSelection.ids] : [];
}
