import {
	UNKNOWN_SOURCE_FILE,
	TOP_LIMIT,
	FILE_CATEGORIES,
	RSVP_DOMAIN_PREDICATES,
} from './constants.js';

export function compareText(a: unknown, b: unknown): number {
	return String(a).localeCompare(String(b));
}

export function compareMetricThenText(metricKey: string, textKey: string) {
	return (a: Record<string, unknown>, b: Record<string, unknown>) =>
		(b[metricKey] as number) - (a[metricKey] as number) || compareText(a[textKey], b[textKey]);
}

export function toNormalizedPath(sourceFile: unknown): string {
	return typeof sourceFile === 'string' ? sourceFile.replaceAll('\\', '/') : '';
}

export function normalizeSourceFileForSort(sourceFile: unknown): string {
	return sourceFile != null ? String(sourceFile) : '(missing source_file)';
}

export function toSourceFile(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : UNKNOWN_SOURCE_FILE;
}

export function increment(map: Map<string, number>, key: string, amount = 1): void {
	map.set(key, (map.get(key) ?? 0) + amount);
}

export function createCategoryBuckets<T>(factory: () => T): Record<string, T> {
	return Object.fromEntries(FILE_CATEGORIES.map((category) => [category, factory()]));
}

export interface MetricRecord {
	degree: number;
	sourceOrientedCount: number;
	targetOrientedCount: number;
	crossCommunityEdgeCount: number;
	relations: Map<string, number>;
}

function createMetricRecord(): MetricRecord {
	return {
		degree: 0,
		sourceOrientedCount: 0,
		targetOrientedCount: 0,
		crossCommunityEdgeCount: 0,
		relations: new Map(),
	};
}

function getMetricRecord(map: Map<string | null, MetricRecord>, key: string | null): MetricRecord {
	if (!map.has(key)) {
		map.set(key, createMetricRecord());
	}
	return map.get(key) as MetricRecord;
}

export function classifyFileCategory(sourceFile: unknown): string {
	if (typeof sourceFile !== 'string' || sourceFile.length === 0) {
		return 'other';
	}

	const normalized = sourceFile.replaceAll('\\', '/');
	if (normalized.startsWith('src/')) return 'src';
	if (normalized.startsWith('tests/')) return 'tests';
	if (normalized.startsWith('scripts/')) return 'scripts';
	if (normalized.startsWith('supabase/')) return 'supabase';
	if (!normalized.includes('/')) return 'configRoot';
	return 'other';
}

export function classifyRsvpDomainGroup(sourceFile: unknown): string | null {
	const normalized = toNormalizedPath(sourceFile).toLowerCase();
	if (!normalized) {
		return null;
	}

	return RSVP_DOMAIN_PREDICATES.find((predicate) => predicate.matches(normalized))?.group ?? null;
}

function isTestOrFixture(sourceFile: unknown): boolean {
	const normalized = toNormalizedPath(sourceFile);
	return (
		normalized.startsWith('tests/') ||
		normalized.includes('/__fixtures__/') ||
		normalized.includes('/fixtures/') ||
		/\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)
	);
}

function isMigrationOrSql(sourceFile: unknown): boolean {
	const normalized = toNormalizedPath(sourceFile);
	return (
		normalized.startsWith('supabase/migrations/') ||
		normalized.startsWith('supabase/verification/') ||
		normalized.startsWith('scripts/manual/') ||
		normalized.startsWith('scripts/sql/') ||
		normalized.startsWith('scripts/db/sql/') ||
		normalized.endsWith('.sql')
	);
}

function isEntrypointOrRuntimeBoundary(sourceFile: unknown): boolean {
	const normalized = toNormalizedPath(sourceFile);
	return normalized.startsWith('src/pages/');
}

export function classifyCleanupSection(record: Record<string, unknown>): string {
	const sourceFile = record.sourceFile;
	const category = (record.category as string) ?? classifyFileCategory(sourceFile);

	if (sourceFile === null || sourceFile === undefined) {
		return 'lowConfidenceNoise';
	}
	if (isEntrypointOrRuntimeBoundary(sourceFile)) {
		return 'entrypointsOrRuntimeBoundaries';
	}
	if (isTestOrFixture(sourceFile) || category === 'tests') {
		return 'testsAndFixtures';
	}
	if (isMigrationOrSql(sourceFile)) {
		return 'migrationsAndSql';
	}
	if (category === 'scripts') {
		return 'scriptsAndTooling';
	}
	if (category === 'configRoot' || category === 'other') {
		return 'lowConfidenceNoise';
	}
	if (category === 'src' && (record.degree as number) === 0) {
		return 'highConfidenceReviewCandidates';
	}
	return 'lowConfidenceNoise';
}

function relationList(relations: Map<string, number>) {
	return [...relations.entries()]
		.map(([relation, count]) => ({ relation, count }))
		.sort(compareMetricThenText('count', 'relation'));
}

export function fileMetricToJson(
	sourceFile: string | null,
	metric: MetricRecord,
	nodesByFile: Map<string | null, Record<string, unknown>[]>,
) {
	return {
		sourceFile,
		category: classifyFileCategory(sourceFile),
		degree: metric.degree,
		sourceOrientedCount: metric.sourceOrientedCount,
		targetOrientedCount: metric.targetOrientedCount,
		crossCommunityEdgeCount: metric.crossCommunityEdgeCount,
		symbolCount: nodesByFile.get(sourceFile)?.length ?? 0,
		topRelations: relationList(metric.relations).slice(0, 5),
	};
}

export function nodeMetricToJson(node: Record<string, unknown>, metric: MetricRecord | undefined) {
	const sourceFile = toSourceFile(node.source_file);
	return {
		id: node.id,
		label: (node.label as string) ?? node.id,
		sourceFile,
		category: classifyFileCategory(sourceFile),
		community: (node.community as string | null) ?? null,
		degree: metric?.degree ?? 0,
		sourceOrientedCount: metric?.sourceOrientedCount ?? 0,
		targetOrientedCount: metric?.targetOrientedCount ?? 0,
		crossCommunityEdgeCount: metric?.crossCommunityEdgeCount ?? 0,
	};
}

export function topFileRecords(
	nodes: Record<string, unknown>[],
	indexes: {
		fileMetrics: Map<string | null, MetricRecord>;
		nodesByFile: Map<string | null, Record<string, unknown>[]>;
	},
	limit = TOP_LIMIT,
) {
	const sourceFiles = [...new Set(nodes.map((node) => toSourceFile(node.source_file)))];
	return sourceFiles
		.map((sourceFile) =>
			fileMetricToJson(
				sourceFile,
				indexes.fileMetrics.get(sourceFile) as MetricRecord,
				indexes.nodesByFile,
			),
		)
		.sort(compareMetricThenText('degree', 'sourceFile'))
		.slice(0, limit);
}

export function groupByCategory(records: Record<string, unknown>[]) {
	const byCategory = createCategoryBuckets(() => [] as Record<string, unknown>[]);
	for (const record of records) {
		byCategory[record.category as string].push(record);
	}
	for (const category of FILE_CATEGORIES) {
		byCategory[category].sort(compareMetricThenText('degree', 'sourceFile'));
	}
	return { byCategory };
}

export interface GraphIndexes {
	nodesById: Map<string, Record<string, unknown>>;
	nodeMetrics: Map<string, MetricRecord>;
	fileMetrics: Map<string | null, MetricRecord>;
	nodesByFile: Map<string | null, Record<string, unknown>[]>;
	nodesByCommunity: Map<string, Record<string, unknown>[]>;
	linksByCommunity: Map<string, Record<string, unknown>[]>;
	communityIds: Set<string>;
}

export function buildGraphIndexes(
	graph: Record<string, unknown>,
	analysis: Record<string, unknown>,
): GraphIndexes {
	const nodesById = new Map<string, Record<string, unknown>>();
	const nodeMetrics = new Map<string, MetricRecord>();
	const fileMetrics = new Map<string | null, MetricRecord>();
	const nodesByFile = new Map<string | null, Record<string, unknown>[]>();
	const nodesByCommunity = new Map<string, Record<string, unknown>[]>();
	const linksByCommunity = new Map<string, Record<string, unknown>[]>();

	const nodes = graph.nodes as Record<string, unknown>[];
	const links = graph.links as Record<string, unknown>[];

	for (const node of nodes) {
		nodesById.set(node.id as string, node);
		const sourceFile = toSourceFile(node.source_file);
		if (!nodesByFile.has(sourceFile)) {
			nodesByFile.set(sourceFile, []);
		}
		(nodesByFile.get(sourceFile) as Record<string, unknown>[]).push(node);

		const communityId = String(node.community ?? '');
		if (!nodesByCommunity.has(communityId)) {
			nodesByCommunity.set(communityId, []);
		}
		(nodesByCommunity.get(communityId) as Record<string, unknown>[]).push(node);
	}

	for (const link of links) {
		const sourceNode = nodesById.get(link.source as string);
		const targetNode = nodesById.get(link.target as string);
		if (!sourceNode || !targetNode) {
			continue;
		}

		const sourceCommunity = String(sourceNode.community ?? '');
		const targetCommunity = String(targetNode.community ?? '');
		const isCrossCommunity = sourceCommunity !== targetCommunity;
		const relation = (link.relation as string) ?? 'unknown';

		const sourceNodeMetrics = getMetricRecord(nodeMetrics, sourceNode.id as string);
		sourceNodeMetrics.degree += 1;
		sourceNodeMetrics.sourceOrientedCount += 1;
		if (isCrossCommunity) sourceNodeMetrics.crossCommunityEdgeCount += 1;
		increment(sourceNodeMetrics.relations, relation);

		const targetNodeMetrics = getMetricRecord(nodeMetrics, targetNode.id as string);
		targetNodeMetrics.degree += 1;
		targetNodeMetrics.targetOrientedCount += 1;
		if (isCrossCommunity) targetNodeMetrics.crossCommunityEdgeCount += 1;
		increment(targetNodeMetrics.relations, relation);

		for (const [node] of [
			[sourceNode, 'source'],
			[targetNode, 'target'],
		] as [Record<string, unknown>, string][]) {
			const sf = toSourceFile(node.source_file);
			const metric = getMetricRecord(fileMetrics, sf);
			metric.degree += 1;
			if (node === sourceNode) {
				metric.sourceOrientedCount += 1;
			} else {
				metric.targetOrientedCount += 1;
			}
			if (isCrossCommunity) metric.crossCommunityEdgeCount += 1;
			increment(metric.relations, relation);
		}

		for (const communityId of new Set([sourceCommunity, targetCommunity])) {
			if (!linksByCommunity.has(communityId)) {
				linksByCommunity.set(communityId, []);
			}
			(linksByCommunity.get(communityId) as Record<string, unknown>[]).push(link);
		}
	}

	for (const node of nodes) {
		getMetricRecord(nodeMetrics, node.id as string);
		getMetricRecord(fileMetrics, toSourceFile(node.source_file));
	}

	return {
		nodesById,
		nodeMetrics,
		fileMetrics,
		nodesByFile,
		nodesByCommunity,
		linksByCommunity,
		communityIds: new Set(Object.keys(analysis.communities as Record<string, unknown>)),
	};
}
