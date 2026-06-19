import {
	FILE_CATEGORIES,
	RSVP_DOMAIN_GROUPS,
	INTAKE_PUBLISHING_DOMAIN_GROUPS,
	INVITATION_RENDERING_DOMAIN_GROUPS,
	THEME_ASSETS_DOMAIN_GROUPS,
	TOP_LIMIT,
} from './constants.js';
import type { DomainGroupDef } from './constants.js';
import { normalizeSourceFileForSort } from './core.js';

const FILE_METRIC_HEADERS = [
	'File',
	'degree',
	'sourceOrientedCount',
	'targetOrientedCount',
	'crossCommunityEdgeCount',
];
const NODE_METRIC_HEADERS = [
	'Node',
	'File',
	'degree',
	'sourceOrientedCount',
	'targetOrientedCount',
	'crossCommunityEdgeCount',
];

function directionCaveat(metadata: Record<string, unknown>): string {
	return `Graph directed flag: \`${metadata.graphDirected}\`. Because Graphify marks this graph as undirected, source/target metrics are orientation hints from stored link fields, not true dependency direction.`;
}

function markdownTable(headers: string[], rows: string[][]): string {
	if (rows.length === 0) {
		return '_No entries._';
	}
	const headerLine = `| ${headers.join(' | ')} |`;
	const separator = `| ${headers.map(() => '---').join(' | ')} |`;
	const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
	return `${headerLine}\n${separator}\n${body}`;
}

export function renderCommunitySummaryMarkdown(summary: Record<string, unknown>): string {
	const communities = summary.communities as Record<string, unknown>[];
	const rows = communities.slice(0, 40).map((community) => [
		community.communityId as string,
		String(community.size),
		String(community.internalEdgeCount),
		String(community.externalEdgeCount),
		(community.topFiles as Record<string, unknown>[])
			.slice(0, 3)
			.map((file) => normalizeSourceFileForSort(file.sourceFile))
			.join('<br>'),
	]);

	return [
		'# Graphify Community Summary',
		'',
		directionCaveat(summary),
		'',
		`Source graph: \`${summary.sourceGraphPath}\``,
		`Built at commit: \`${summary.builtAtCommit ?? 'unknown'}\``,
		`Input: ${summary.nodeCount} nodes, ${summary.linkCount} links.`,
		`Graph community count: ${summary.graphCommunityCount}.`,
		`Analysis community count: ${summary.analysisCommunityCount}.`,
		summary.communityCountMismatch
			? '**Community count mismatch:** `graph.json` node metadata and `.graphify_analysis.json` disagree. This report lists analysis-backed communities and preserves the mismatch in JSON metadata.'
			: 'Community counts match between `graph.json` node metadata and `.graphify_analysis.json`.',
		'',
		markdownTable(['Community', 'Size', 'Internal edges', 'External edges', 'Top files'], rows),
		'',
	].join('\n');
}

function renderCategorySections(
	categories: Record<
		string,
		{ files: Record<string, unknown>[]; nodes: Record<string, unknown>[] }
	>,
	fieldName: 'files' | 'nodes',
): string {
	return FILE_CATEGORIES.map((category) => {
		const rows = categories[category][fieldName]
			.slice(0, TOP_LIMIT)
			.map((item) => [
				normalizeSourceFileForSort(item.sourceFile ?? item.id),
				String(item.degree),
				String(item.sourceOrientedCount),
				String(item.targetOrientedCount),
				String(item.crossCommunityEdgeCount),
			]);
		const headers = fieldName === 'files' ? FILE_METRIC_HEADERS : NODE_METRIC_HEADERS;
		return [`## ${category}`, '', markdownTable(headers, rows)].join('\n');
	}).join('\n\n');
}

export function renderRiskHubsMarkdown(risk: Record<string, unknown>): string {
	return [
		'# Graphify Risk Hubs',
		'',
		directionCaveat(risk),
		'',
		'Files and nodes are split by category so test-only hubs are not treated as runtime architecture risks.',
		'',
		'# File Hubs',
		'',
		renderCategorySections(
			risk.categories as Record<
				string,
				{ files: Record<string, unknown>[]; nodes: Record<string, unknown>[] }
			>,
			'files',
		),
		'',
		'# Node Hubs',
		'',
		renderCategorySections(
			risk.categories as Record<
				string,
				{ files: Record<string, unknown>[]; nodes: Record<string, unknown>[] }
			>,
			'nodes',
		),
		'',
	].join('\n');
}

function cleanupSectionTitle(sectionKey: string): string {
	return sectionKey.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function renderCleanupSection(title: string, records: Record<string, unknown>[]): string {
	const rows = records
		.slice(0, TOP_LIMIT)
		.map((item) => [
			normalizeSourceFileForSort(item.sourceFile),
			item.category as string,
			String(item.degree),
			String(item.sourceOrientedCount),
			String(item.targetOrientedCount),
			String(item.crossCommunityEdgeCount),
			(item.signals as string[]).join('<br>'),
		]);
	return [
		`## ${cleanupSectionTitle(title)}`,
		'',
		markdownTable(
			[
				'Entry',
				'Category',
				'degree',
				'sourceOrientedCount',
				'targetOrientedCount',
				'crossCommunityEdgeCount',
				'Signals',
			],
			rows,
		),
	].join('\n');
}

export function renderCleanupMarkdown(cleanup: Record<string, unknown>): string {
	const sections = cleanup.sections as Record<string, Record<string, unknown>[]>;
	return [
		'# Graphify Cleanup Report',
		'',
		directionCaveat(cleanup),
		'',
		'Cleanup sections are review queues, not deletion instructions. Entry points, tests, migrations, SQL, scripts, and low-confidence artifacts stay visible but are separated from high-confidence review candidates.',
		'',
		`Single-node communities: ${(cleanup.singleNodeCommunities as unknown[]).length}.`,
		'',
		renderCleanupSection(
			'highConfidenceReviewCandidates',
			sections.highConfidenceReviewCandidates,
		),
		'',
		renderCleanupSection(
			'entrypointsOrRuntimeBoundaries',
			sections.entrypointsOrRuntimeBoundaries,
		),
		'',
		renderCleanupSection('testsAndFixtures', sections.testsAndFixtures),
		'',
		renderCleanupSection('migrationsAndSql', sections.migrationsAndSql),
		'',
		renderCleanupSection('scriptsAndTooling', sections.scriptsAndTooling),
		'',
		renderCleanupSection('lowConfidenceNoise', sections.lowConfidenceNoise),
		'',
	].join('\n');
}

function renderDomainFileRows(files: Record<string, unknown>[]): string[][] {
	return files
		.slice(0, TOP_LIMIT)
		.map((file) => [
			normalizeSourceFileForSort(file.sourceFile),
			String(file.degree),
			String(file.sourceOrientedCount),
			String(file.targetOrientedCount),
			String(file.crossCommunityEdgeCount),
		]);
}

function renderDomainNodeRows(nodes: Record<string, unknown>[]): string[][] {
	return nodes
		.slice(0, TOP_LIMIT)
		.map((node) => [
			node.id as string,
			normalizeSourceFileForSort(node.sourceFile),
			String(node.degree),
			String(node.sourceOrientedCount),
			String(node.targetOrientedCount),
			String(node.crossCommunityEdgeCount),
		]);
}

function renderRsvpChecklist(): string[] {
	return [
		'- RSVP submitted state: inspect public RSVP components, RSVP hooks, `src/lib/client/rsvp-api.ts`, invitation RSVP API routes, and server RSVP services/repositories together.',
		'- Response editing / change my response: verify the same public, client API, invitation API, and `rsvp-submission.service.ts` path before changing edit eligibility or resubmission behavior.',
		'- Protected location after RSVP: verify gated/protected location helpers, `src/pages/api/invitacion/[inviteId]/location.ts`, and any RSVP submission state that unlocks location data.',
		'- Add-to-calendar / time: verify `AddToCalendarButton`, `src/lib/calendar/**`, and `src/lib/time/**` when changing event dates, time zones, or generated calendar payloads.',
		'- Dashboard RSVP / guest management: check dashboard guest components, dashboard guest APIs, and `dashboard-guests.service.ts` for host-side RSVP state changes.',
		'- Tests: run the RSVP/API/component/calendar tests surfaced in this report before treating the change as safe.',
	];
}

export function renderRsvpDomainMarkdown(report: Record<string, unknown>): string {
	return renderOperationalDomainMarkdown({
		report,
		title: 'Graphify Domain RSVP',
		groupDefs: RSVP_DOMAIN_GROUPS,
		scopeNote:
			'Path-filtered RSVP pilot covering public RSVP, location gating, calendar/time, dashboard guest management, and RSVP tests.',
		checklist: renderRsvpChecklist(),
	});
}

function renderDomainGroupSections(
	groups: Record<
		string,
		{ title: string; files: Record<string, unknown>[]; nodes: Record<string, unknown>[] }
	>,
	groupDefs: DomainGroupDef[],
): string {
	return groupDefs
		.map(({ id, title }) => {
			const bucket = groups[id];
			return [
				`### ${title}`,
				'',
				'Files',
				'',
				markdownTable(FILE_METRIC_HEADERS, renderDomainFileRows(bucket.files)),
				'',
				'Nodes',
				'',
				markdownTable(NODE_METRIC_HEADERS, renderDomainNodeRows(bucket.nodes)),
			].join('\n');
		})
		.join('\n\n');
}

function renderCrossBoundaryRows(links: Record<string, unknown>[]): string[][] {
	return links
		.slice(0, TOP_LIMIT)
		.map((link) => [
			normalizeSourceFileForSort(link.sourceFile),
			(link.sourceGroup as string) ?? '(outside domain)',
			normalizeSourceFileForSort(link.targetFile),
			(link.targetGroup as string) ?? '(outside domain)',
			link.relation as string,
			String(link.crossCommunityEdgeCount),
		]);
}

function renderOperationalDomainMarkdown({
	report,
	title,
	groupDefs,
	checklist,
	scopeNote,
}: {
	report: Record<string, unknown>;
	title: string;
	groupDefs: DomainGroupDef[];
	checklist: string[];
	scopeNote: string;
}): string {
	const groups = report.groups as Record<
		string,
		{ title: string; files: Record<string, unknown>[]; nodes: Record<string, unknown>[] }
	>;
	const topRiskFiles = report.topRiskFiles as Record<string, unknown>[];
	const topCrossBoundaryLinks = report.topCrossBoundaryLinks as Record<string, unknown>[];
	const testsTouchingDomain = report.testsTouchingDomain as Record<string, unknown>[];

	return [
		`# ${title}`,
		'',
		directionCaveat(report),
		'',
		scopeNote,
		'',
		'Graphify findings are leads, not authority. Inspect the live code and active docs before changing behavior.',
		'',
		`Source graph: \`${report.sourceGraphPath}\``,
		`Built at commit: \`${report.builtAtCommit ?? 'unknown'}\``,
		`Input: ${report.nodeCount} nodes, ${report.linkCount} links.`,
		`Domain files: ${report.domainFileCount}.`,
		`Domain nodes: ${report.domainNodeCount}.`,
		`Graph community count: ${report.graphCommunityCount}.`,
		`Analysis community count: ${report.analysisCommunityCount}.`,
		report.communityCountMismatch
			? '**Community count mismatch:** `graph.json` node metadata and `.graphify_analysis.json` disagree.'
			: 'Community counts match between `graph.json` node metadata and `.graphify_analysis.json`.',
		'',
		'## grouped-files-and-nodes',
		'',
		renderDomainGroupSections(groups, groupDefs),
		'',
		'## top-risk-files',
		'',
		markdownTable(
			[
				'File',
				'Group',
				'degree',
				'sourceOrientedCount',
				'targetOrientedCount',
				'crossCommunityEdgeCount',
			],
			topRiskFiles
				.slice(0, TOP_LIMIT)
				.map((file) => [
					normalizeSourceFileForSort(file.sourceFile),
					file.group as string,
					String(file.degree),
					String(file.sourceOrientedCount),
					String(file.targetOrientedCount),
					String(file.crossCommunityEdgeCount),
				]),
		),
		'',
		'## top-cross-boundary-links',
		'',
		markdownTable(
			[
				'Source file',
				'Source group',
				'Target file',
				'Target group',
				'Relation',
				'crossCommunityEdgeCount',
			],
			renderCrossBoundaryRows(topCrossBoundaryLinks),
		),
		'',
		'## tests-touching-domain',
		'',
		markdownTable(FILE_METRIC_HEADERS, renderDomainFileRows(testsTouchingDomain)),
		'',
		'## practical-change-checklist',
		'',
		checklist.join('\n'),
		'',
	].join('\n');
}

function renderIntakePublishingChecklist(): string[] {
	return [
		'- Effective content: inspect merge, editor hydration, preview, and publish paths together before changing precedence.',
		'- Interludes: verify they survive draft, published, preview, and publish flows when they are SQL/demo-only content.',
		'- `_assetSlug`: preserve the route slug, preview slug, and asset slug distinction through mapping and publish validation.',
		'- Optimistic locking: check editor section and metadata save paths before changing draft writes.',
		'- Section schema parity: compare draft schema, editor schema, published schema, section mapper, and renderer expectations.',
		'- Draft-to-published mapping: verify forward and reverse mapping when a section gains or loses fields.',
		'- Preview vs published output consistency: preview should use effective content and should not silently diverge from publish output.',
		'- Publish validation: keep schema, event validity, asset resolvability, and RSVP synchronization guards in view.',
	];
}

export function renderIntakePublishingDomainMarkdown(report: Record<string, unknown>): string {
	return renderOperationalDomainMarkdown({
		report,
		title: 'Graphify Domain Intake Publishing',
		groupDefs: INTAKE_PUBLISHING_DOMAIN_GROUPS,
		scopeNote:
			'This view lists likely related files for intake editor, draft, merge, preview, and publish changes. It is not a complete dependency graph.',
		checklist: renderIntakePublishingChecklist(),
	});
}

function renderInvitationRenderingChecklist(): string[] {
	return [
		'- Public route resolution: inspect route files, content resolver, page-data assembly, and adapter output together.',
		'- DB/static fallback: preserve the distinction between DB-published client content and static demo/template fallback.',
		'- route slug vs `_assetSlug`: keep public URL identity separate from internal asset registry identity.',
		'- Short-link personalization: verify short-link route resolution and route personalization helpers together.',
		'- Render plan: check section ordering, optional section visibility, and render-data shaping before changing components.',
		'- Metadata: keep social metadata and page-data inputs aligned when changing title, images, or canonical route data.',
		'- Adapter output consistency: ensure adapted event view models still satisfy public component props.',
		'- Static/demo content boundaries: avoid treating content JSON files as real client invitation sources.',
	];
}

export function renderInvitationRenderingDomainMarkdown(report: Record<string, unknown>): string {
	return renderOperationalDomainMarkdown({
		report,
		title: 'Graphify Domain Invitation Rendering',
		groupDefs: INVITATION_RENDERING_DOMAIN_GROUPS,
		scopeNote:
			'This view lists likely related files for public invitation route rendering and page-data changes. RSVP submission behavior remains in the RSVP view.',
		checklist: renderInvitationRenderingChecklist(),
	});
}

function renderThemeAssetsChecklist(): string[] {
	return [
		'- SCSS only: maintained styling belongs in SCSS files; no Tailwind.',
		'- Use shared vocabulary: import event types, presets, and section keys from `theme-contract.ts` rather than duplicating literals.',
		'- Preserve `_assetSlug`: keep route slug, preview slug, and asset registry slug distinct.',
		'- Section boundaries: verify section registry, section render data, component entry, and tests when changing section contracts.',
		'- Schema/mapper/renderer: when section content changes, verify draft schema, mapper, adapter, and public renderer together.',
		'- Section partials: do not create section partials for symmetry; use them only when tokens cannot express the behavior.',
		'- Expected centrality: high centrality for `theme-contract.ts` and asset registry files is expected and is not automatically a risk.',
		'- Inventory guardrail: this view intentionally excludes individual images and pure visual-only files unless they represent a cross-layer boundary.',
	];
}

export function renderThemeAssetsDomainMarkdown(report: Record<string, unknown>): string {
	return renderOperationalDomainMarkdown({
		report,
		title: 'Graphify Domain Theme Assets',
		groupDefs: THEME_ASSETS_DOMAIN_GROUPS,
		scopeNote:
			'This view is scoped to cross-layer theme, section, and asset contracts. It is not a styling or image inventory.',
		checklist: renderThemeAssetsChecklist(),
	});
}

export function renderOperationalReadme(metadata: Record<string, unknown>): string {
	return [
		'# Graphify Operational Reports',
		'',
		'These files are local-only derived reports generated from `graphify-out/graph.json` and `graphify-out/.graphify_analysis.json`.',
		'',
		directionCaveat(metadata),
		'',
		'- `community-summary.json` / `community-summary.md`: community sizes, cohesion, internal/external edges, and representative files.',
		'- `risk-hubs.json` / `risk-hubs.md`: high-degree files and nodes split by file category.',
		'- `cleanup-report.json` / `cleanup-report.md`: singleton communities, isolated nodes/files, and source-oriented-only files.',
		'- `domain-rsvp.json` / `domain-rsvp.md`: path-filtered RSVP pilot covering public RSVP, location gating, calendar/time, dashboard guest management, and RSVP tests.',
		'- `domain-intake-publishing.json` / `domain-intake-publishing.md`: likely related files for editor, draft, merge, preview, publish, and intake publishing tests.',
		'- `domain-invitation-rendering.json` / `domain-invitation-rendering.md`: likely related files for public routes, content resolution, page-data, adapters, render plans, public components, and rendering tests.',
		'- `domain-theme-assets.json` / `domain-theme-assets.md`: cross-layer theme vocabulary, asset registry, section boundary, styling contract, and focused test files without image/style inventory.',
		'',
		'Use a domain view when a task crosses route, API, service, schema, mapper, component, style, and test layers. Do not use Graphify for one-file edits, copy-only changes, tiny CSS changes, or cases where source code and active docs already answer the question directly.',
		'',
		'Graphify findings are leads, not authority. Raw Graphify outputs remain unchanged and source code plus active docs remain the source of truth.',
		'',
	].join('\n');
}
