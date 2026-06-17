import { FILE_CATEGORIES, RSVP_DOMAIN_GROUPS, TOP_LIMIT } from './constants.js';
import { normalizeSourceFileForSort } from './core.js';

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
		return [
			`## ${category}`,
			'',
			markdownTable(
				[
					fieldName === 'files' ? 'File' : 'Node',
					'degree',
					'sourceOrientedCount',
					'targetOrientedCount',
					'crossCommunityEdgeCount',
				],
				rows,
			),
		].join('\n');
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

function renderRsvpGroupSections(
	groups: Record<
		string,
		{ title: string; files: Record<string, unknown>[]; nodes: Record<string, unknown>[] }
	>,
): string {
	return RSVP_DOMAIN_GROUPS.map(({ id, title }) => {
		const bucket = groups[id];
		return [
			`### ${title}`,
			'',
			'Files',
			'',
			markdownTable(
				[
					'File',
					'degree',
					'sourceOrientedCount',
					'targetOrientedCount',
					'crossCommunityEdgeCount',
				],
				renderDomainFileRows(bucket.files),
			),
			'',
			'Nodes',
			'',
			markdownTable(
				[
					'Node',
					'File',
					'degree',
					'sourceOrientedCount',
					'targetOrientedCount',
					'crossCommunityEdgeCount',
				],
				renderDomainNodeRows(bucket.nodes),
			),
		].join('\n');
	}).join('\n\n');
}

function renderRsvpCrossBoundaryRows(links: Record<string, unknown>[]): string[][] {
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
	const groups = report.groups as Record<
		string,
		{ title: string; files: Record<string, unknown>[]; nodes: Record<string, unknown>[] }
	>;
	const topRiskFiles = report.topRiskFiles as Record<string, unknown>[];
	const topCrossBoundaryLinks = report.topCrossBoundaryLinks as Record<string, unknown>[];
	const testsTouchingRsvp = report.testsTouchingRsvp as Record<string, unknown>[];

	return [
		'# Graphify Domain RSVP',
		'',
		directionCaveat(report),
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
		renderRsvpGroupSections(groups),
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
			renderRsvpCrossBoundaryRows(topCrossBoundaryLinks),
		),
		'',
		'## tests-touching-rsvp',
		'',
		markdownTable(
			[
				'File',
				'degree',
				'sourceOrientedCount',
				'targetOrientedCount',
				'crossCommunityEdgeCount',
			],
			renderDomainFileRows(testsTouchingRsvp),
		),
		'',
		'## practical-change-checklist',
		'',
		renderRsvpChecklist().join('\n'),
		'',
	].join('\n');
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
		'',
		'Raw Graphify outputs remain unchanged and remain the diagnostic source of truth.',
		'',
	].join('\n');
}
