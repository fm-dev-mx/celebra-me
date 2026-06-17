import { FILE_CATEGORIES, RSVP_DOMAIN_GROUPS, TOP_LIMIT } from './constants.js';
import {
	compareText,
	compareMetricThenText,
	createCategoryBuckets,
	classifyFileCategory,
	classifyRsvpDomainGroup,
	classifyCleanupSection,
	toSourceFile,
	fileMetricToJson,
	nodeMetricToJson,
	topFileRecords,
	groupByCategory,
} from './core.js';
import type { GraphIndexes, MetricRecord } from './core.js';
export { buildGraphIndexes } from './core.js';

function baseMetadata(
	graph: Record<string, unknown>,
	analysis: Record<string, unknown>,
	options: { sourceGraphPath: string },
) {
	const nodes = graph.nodes as Record<string, unknown>[];
	const graphCommunityCount = new Set(
		nodes
			.map((node) => node.community as string | undefined)
			.filter((community) => community !== undefined && community !== null)
			.map(String),
	).size;
	const analysisCommunityCount = Object.keys(
		analysis.communities as Record<string, unknown>,
	).length;
	return {
		builtAtCommit: (graph.built_at_commit as string) ?? null,
		graphDirected: Boolean(graph.directed),
		sourceGraphPath: options.sourceGraphPath,
		nodeCount: nodes.length,
		linkCount: (graph.links as unknown[]).length,
		graphCommunityCount,
		analysisCommunityCount,
		communityCount: analysisCommunityCount,
		communityCountMismatch: graphCommunityCount !== analysisCommunityCount,
	};
}

function compareDomainFile(a: Record<string, unknown>, b: Record<string, unknown>): number {
	return (
		(b.degree as number) - (a.degree as number) ||
		(b.crossCommunityEdgeCount as number) - (a.crossCommunityEdgeCount as number) ||
		compareText(a.sourceFile, b.sourceFile)
	);
}

function compareDomainLink(a: Record<string, unknown>, b: Record<string, unknown>): number {
	return (
		(b.domainEndpointCount as number) - (a.domainEndpointCount as number) ||
		(b.crossCommunityEdgeCount as number) - (a.crossCommunityEdgeCount as number) ||
		compareText(a.sourceFile, b.sourceFile) ||
		compareText(a.targetFile, b.targetFile) ||
		compareText(a.relation, b.relation)
	);
}

function buildCleanupSections(fileRecords: Record<string, unknown>[]) {
	const sections: Record<string, Record<string, unknown>[]> = {
		highConfidenceReviewCandidates: [],
		entrypointsOrRuntimeBoundaries: [],
		testsAndFixtures: [],
		migrationsAndSql: [],
		scriptsAndTooling: [],
		lowConfidenceNoise: [],
	};
	const candidates = fileRecords
		.filter(
			(file) => (file.degree as number) === 0 || (file.targetOrientedCount as number) === 0,
		)
		.map((file) => ({
			...file,
			signals: [
				(file.degree as number) === 0 ? 'isolated-file' : null,
				(file.sourceOrientedCount as number) > 0 &&
				(file.targetOrientedCount as number) === 0
					? 'source-oriented-only'
					: null,
				(file.targetOrientedCount as number) === 0 ? 'no-target-oriented-edges' : null,
			].filter(Boolean),
		}));

	for (const candidate of candidates) {
		sections[classifyCleanupSection(candidate)].push(candidate);
	}
	for (const section of Object.values(sections)) {
		section.sort(compareMetricThenText('degree', 'sourceFile'));
	}
	return sections;
}

function createRsvpGroupBuckets() {
	return Object.fromEntries(
		RSVP_DOMAIN_GROUPS.map(({ id, title }) => [
			id,
			{
				title,
				files: [] as Record<string, unknown>[],
				nodes: [] as Record<string, unknown>[],
			},
		]),
	);
}

export function computeCommunitySummary(
	graph: Record<string, unknown>,
	analysis: Record<string, unknown>,
	indexes: GraphIndexes,
	options: { sourceGraphPath: string },
) {
	const communities = Object.entries(analysis.communities as Record<string, string[]>)
		.map(([communityId, nodeIds]) => {
			const nodeSet = new Set(nodeIds);
			const nodes = nodeIds
				.map((nodeId) => indexes.nodesById.get(nodeId))
				.filter(Boolean) as Record<string, unknown>[];
			let internalEdgeCount = 0;
			let externalEdgeCount = 0;
			const crossLinks: Record<string, unknown>[] = [];

			const links = graph.links as Record<string, unknown>[];
			for (const link of links) {
				const sourceInCommunity = nodeSet.has(link.source as string);
				const targetInCommunity = nodeSet.has(link.target as string);
				if (sourceInCommunity && targetInCommunity) {
					internalEdgeCount += 1;
				} else if (sourceInCommunity || targetInCommunity) {
					externalEdgeCount += 1;
					crossLinks.push(link);
				}
			}

			return {
				communityId,
				label: `Community ${communityId}`,
				size: nodeIds.length,
				cohesion:
					((analysis.cohesion as Record<string, unknown>)?.[communityId] as number) ??
					null,
				internalEdgeCount,
				externalEdgeCount,
				topFiles: topFileRecords(nodes, indexes, 8),
				topCrossCommunityLinks: crossLinks
					.map((link) => {
						const sourceNode = indexes.nodesById.get(link.source as string);
						const targetNode = indexes.nodesById.get(link.target as string);
						return {
							source: link.source,
							sourceLabel: (sourceNode?.label as string) ?? link.source,
							sourceFile: toSourceFile(sourceNode?.source_file),
							target: link.target,
							targetLabel: (targetNode?.label as string) ?? link.target,
							targetFile: toSourceFile(targetNode?.source_file),
							relation: (link.relation as string) ?? 'unknown',
						};
					})
					.sort(
						(a, b) =>
							compareText(a.sourceLabel, b.sourceLabel) ||
							compareText(a.targetLabel, b.targetLabel),
					)
					.slice(0, 10),
			};
		})
		.sort((a, b) => b.size - a.size || compareText(a.communityId, b.communityId));

	return {
		...baseMetadata(graph, analysis, options),
		communities,
	};
}

export function computeRiskHubs(
	graph: Record<string, unknown>,
	indexes: GraphIndexes,
	options: { sourceGraphPath: string },
) {
	const categories = createCategoryBuckets(() => ({
		files: [] as Record<string, unknown>[],
		nodes: [] as Record<string, unknown>[],
	}));

	for (const [sourceFile, metric] of indexes.fileMetrics.entries()) {
		const category = classifyFileCategory(sourceFile);
		categories[category].files.push(fileMetricToJson(sourceFile, metric, indexes.nodesByFile));
	}

	const nodes = graph.nodes as Record<string, unknown>[];
	for (const node of nodes) {
		const metric = indexes.nodeMetrics.get(node.id as string);
		const category = classifyFileCategory(toSourceFile(node.source_file));
		categories[category].nodes.push(nodeMetricToJson(node, metric));
	}

	for (const category of FILE_CATEGORIES) {
		categories[category].files.sort(compareMetricThenText('degree', 'sourceFile'));
		categories[category].nodes.sort(compareMetricThenText('degree', 'id'));
	}

	return {
		builtAtCommit: (graph.built_at_commit as string) ?? null,
		graphDirected: Boolean(graph.directed),
		sourceGraphPath: options.sourceGraphPath,
		nodeCount: nodes.length,
		linkCount: (graph.links as unknown[]).length,
		categories,
	};
}

export function computeCleanupReport(
	graph: Record<string, unknown>,
	analysis: Record<string, unknown>,
	indexes: GraphIndexes,
	options: { sourceGraphPath: string },
) {
	const singleNodeCommunities = Object.entries(analysis.communities as Record<string, string[]>)
		.filter(([, nodeIds]) => nodeIds.length === 1)
		.map(([communityId, nodeIds]) => {
			const node = indexes.nodesById.get(nodeIds[0]);
			return {
				communityId,
				nodeId: nodeIds[0],
				label: (node?.label as string) ?? nodeIds[0],
				sourceFile: toSourceFile(node?.source_file),
				category: classifyFileCategory(toSourceFile(node?.source_file)),
			};
		})
		.sort((a, b) => compareText(a.communityId, b.communityId));

	const nodes = graph.nodes as Record<string, unknown>[];
	const isolatedNodes = nodes
		.map((node) => nodeMetricToJson(node, indexes.nodeMetrics.get(node.id as string)))
		.filter((node) => node.degree === 0)
		.sort(compareMetricThenText('degree', 'id'));

	const fileRecords = [...indexes.fileMetrics.entries()].map(([sourceFile, metric]) =>
		fileMetricToJson(sourceFile, metric, indexes.nodesByFile),
	);

	const isolatedFiles = fileRecords.filter((file) => file.degree === 0);
	const filesWithSourceOrientedEdgesOnly = fileRecords.filter(
		(file) => file.sourceOrientedCount > 0 && file.targetOrientedCount === 0,
	);
	const filesWithNoTargetOrientedEdges = fileRecords.filter(
		(file) => file.targetOrientedCount === 0,
	);

	return {
		...baseMetadata(graph, analysis, options),
		singleNodeCommunities,
		isolatedNodes: groupByCategory(isolatedNodes),
		isolatedFiles: groupByCategory(isolatedFiles),
		filesWithSourceOrientedEdgesOnly: groupByCategory(filesWithSourceOrientedEdgesOnly),
		filesWithNoTargetOrientedEdges: groupByCategory(filesWithNoTargetOrientedEdges),
		sections: buildCleanupSections(fileRecords),
	};
}

export function computeRsvpDomainReport(
	graph: Record<string, unknown>,
	analysis: Record<string, unknown>,
	indexes: GraphIndexes,
	options: { sourceGraphPath: string },
) {
	const groups = createRsvpGroupBuckets() as Record<
		string,
		{ title: string; files: Record<string, unknown>[]; nodes: Record<string, unknown>[] }
	>;
	const nodeGroups = new Map<string, string>();
	const fileGroups = new Map<string | null, string>();

	const nodes = graph.nodes as Record<string, unknown>[];
	for (const node of nodes) {
		const sourceFile = toSourceFile(node.source_file);
		const group = classifyRsvpDomainGroup(sourceFile);
		if (!group) {
			continue;
		}
		nodeGroups.set(node.id as string, group);
		fileGroups.set(sourceFile, group);
		groups[group].nodes.push({
			...nodeMetricToJson(node, indexes.nodeMetrics.get(node.id as string)),
			group,
		});
	}

	for (const [sourceFile, group] of fileGroups.entries()) {
		groups[group].files.push({
			...fileMetricToJson(
				sourceFile,
				indexes.fileMetrics.get(sourceFile) as MetricRecord,
				indexes.nodesByFile,
			),
			group,
		});
	}

	for (const { id } of RSVP_DOMAIN_GROUPS) {
		groups[id].files.sort(compareDomainFile);
		groups[id].nodes.sort(compareMetricThenText('degree', 'id'));
	}

	const topRiskFiles = [...fileGroups.entries()]
		.map(([sourceFile, group]) => ({
			...fileMetricToJson(
				sourceFile,
				indexes.fileMetrics.get(sourceFile) as MetricRecord,
				indexes.nodesByFile,
			),
			group,
		}))
		.sort(compareDomainFile)
		.slice(0, TOP_LIMIT);

	const links = graph.links as Record<string, unknown>[];
	const topCrossBoundaryLinks = links
		.map((link) => {
			const sourceNode = indexes.nodesById.get(link.source as string);
			const targetNode = indexes.nodesById.get(link.target as string);
			const sourceFile = toSourceFile(sourceNode?.source_file);
			const targetFile = toSourceFile(targetNode?.source_file);
			const sourceGroup = nodeGroups.get(link.source as string) ?? null;
			const targetGroup = nodeGroups.get(link.target as string) ?? null;
			return {
				source: link.source,
				sourceLabel: (sourceNode?.label as string) ?? link.source,
				sourceFile,
				sourceGroup,
				target: link.target,
				targetLabel: (targetNode?.label as string) ?? link.target,
				targetFile,
				targetGroup,
				relation: (link.relation as string) ?? 'unknown',
				domainEndpointCount: Number(Boolean(sourceGroup)) + Number(Boolean(targetGroup)),
				crossCommunityEdgeCount:
					String(sourceNode?.community ?? '') !== String(targetNode?.community ?? '')
						? 1
						: 0,
			};
		})
		.filter(
			(link) =>
				(link.sourceGroup || link.targetGroup) &&
				(link.sourceGroup !== link.targetGroup || !link.sourceGroup || !link.targetGroup),
		)
		.sort(compareDomainLink)
		.slice(0, TOP_LIMIT);

	const testsTouchingRsvp = groups.rsvpTests.files.slice(0, TOP_LIMIT);

	return {
		...baseMetadata(graph, analysis, options),
		domain: 'rsvp',
		domainNodeCount: nodeGroups.size,
		domainFileCount: fileGroups.size,
		groups,
		topRiskFiles,
		topCrossBoundaryLinks,
		testsTouchingRsvp,
	};
}
