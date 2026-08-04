function assertObject(value: unknown, name: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${name} must be an object.`);
	}
	return value as Record<string, unknown>;
}

function assertString(value: unknown, name: string): string {
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`${name} must be a non-empty string.`);
	}
	return value;
}

export interface GraphIntegritySummary {
	nodeCount: number;
	linkCount: number;
	duplicateDirectedPairs: number;
}

export function validateGraphShape(value: unknown): Record<string, unknown> {
	const graph = assertObject(value, 'graph');
	if (!Array.isArray(graph.nodes)) {
		throw new Error('graph.nodes must be an array.');
	}
	if (!Array.isArray(graph.links)) {
		throw new Error('graph.links must be an array.');
	}

	const nodeIds = new Set<string>();
	for (const [index, node] of graph.nodes.entries()) {
		assertObject(node, `graph.nodes[${index}]`);
		const id = assertString((node as Record<string, unknown>).id, `graph.nodes[${index}].id`);
		if (nodeIds.has(id)) {
			throw new Error(`graph.nodes contains duplicate id: ${id}.`);
		}
		nodeIds.add(id);
	}

	for (const [index, link] of graph.links.entries()) {
		assertObject(link, `graph.links[${index}]`);
		const source = assertString(
			(link as Record<string, unknown>).source,
			`graph.links[${index}].source`,
		);
		const target = assertString(
			(link as Record<string, unknown>).target,
			`graph.links[${index}].target`,
		);
		if (!nodeIds.has(source) || !nodeIds.has(target)) {
			throw new Error(
				`graph.links[${index}] has a dangling endpoint: ${source} -> ${target}.`,
			);
		}
	}

	return graph;
}

export function validateGraphIntegrity(
	value: unknown,
	options: { directed?: boolean } = {},
): GraphIntegritySummary {
	const graph = validateGraphShape(value);
	if (options.directed !== undefined && graph.directed !== options.directed) {
		throw new Error(`graph.directed must be ${options.directed}.`);
	}
	const nodes = graph.nodes as Record<string, unknown>[];
	const links = graph.links as Record<string, unknown>[];
	const pairs = links.map((link) => `${String(link.source)}\u0000${String(link.target)}`);
	return {
		nodeCount: nodes.length,
		linkCount: links.length,
		duplicateDirectedPairs: pairs.length - new Set(pairs).size,
	};
}

export function rawEdgeList(raw: Record<string, unknown>): Record<string, unknown>[] {
	const edges = raw.edges ?? raw.links;
	if (!Array.isArray(edges)) {
		throw new Error('Graphify raw graph must contain an edges or links array.');
	}
	return edges as Record<string, unknown>[];
}

export function normalizeRawGraphDirected(raw: Record<string, unknown>): Record<string, unknown> {
	const nodes = raw.nodes;
	if (!Array.isArray(nodes)) {
		throw new Error('Graphify raw graph nodes must be an array.');
	}
	const edges = rawEdgeList(raw);
	const normalizedNodes = [...nodes] as Record<string, unknown>[];
	const nodeIds = new Set<string>();
	for (const [index, node] of nodes.entries()) {
		if (!node || typeof node !== 'object' || Array.isArray(node)) {
			throw new Error(`Graphify raw graph node ${index} must be an object.`);
		}
		const id = assertString((node as Record<string, unknown>).id, `raw.nodes[${index}].id`);
		if (nodeIds.has(id))
			throw new Error(`Graphify raw graph contains duplicate node id: ${id}.`);
		nodeIds.add(id);
	}
	const missingEndpoints = new Set<string>();
	const normalizedEdges = new Map<string, Record<string, unknown>>();
	let collapsedEdgeCount = 0;
	for (const [index, edge] of edges.entries()) {
		if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
			throw new Error(`Graphify raw graph edge ${index} must be an object.`);
		}
		const source = assertString(
			(edge as Record<string, unknown>).source,
			`raw.edges[${index}].source`,
		);
		const target = assertString(
			(edge as Record<string, unknown>).target,
			`raw.edges[${index}].target`,
		);
		if (!nodeIds.has(source)) missingEndpoints.add(source);
		if (!nodeIds.has(target)) missingEndpoints.add(target);
		const pair = `${source}\u0000${target}`;
		const existing = normalizedEdges.get(pair);
		if (existing) {
			collapsedEdgeCount += 1;
			const variants = new Set<string>([
				String(existing.relation ?? 'unknown'),
				...((existing.relation_variants as string[] | undefined) ?? []),
				String((edge as Record<string, unknown>).relation ?? 'unknown'),
			]);
			existing.relation_variants = [...variants].sort();
			continue;
		}
		normalizedEdges.set(pair, { ...(edge as Record<string, unknown>) });
	}
	// Graphify emits package/config references before a node exists for the external symbol.
	// Materializing those references keeps directed clustering from dropping their edges.
	for (const id of [...missingEndpoints].sort()) {
		normalizedNodes.push({ id, label: id, symbolic_reference: true });
		nodeIds.add(id);
	}
	return {
		...raw,
		nodes: normalizedNodes,
		edges: [...normalizedEdges.values()],
		directed: true,
		multigraph: false,
		producer_edge_count: edges.length,
		collapsed_edge_count: collapsedEdgeCount,
	};
}

export function validateAnalysisShape(value: unknown): Record<string, unknown> {
	const analysis = assertObject(value, 'analysis');
	assertObject(analysis.communities, 'analysis.communities');
	assertObject(analysis.cohesion ?? {}, 'analysis.cohesion');

	const communities = analysis.communities as Record<string, unknown>;
	for (const [communityId, nodeIds] of Object.entries(communities)) {
		assertString(communityId, 'analysis community id');
		if (!Array.isArray(nodeIds)) {
			throw new Error(`analysis.communities.${communityId} must be an array.`);
		}
	}

	return analysis;
}
