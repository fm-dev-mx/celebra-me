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

export function validateGraphShape(value: unknown): Record<string, unknown> {
	const graph = assertObject(value, 'graph');
	if (!Array.isArray(graph.nodes)) {
		throw new Error('graph.nodes must be an array.');
	}
	if (!Array.isArray(graph.links)) {
		throw new Error('graph.links must be an array.');
	}

	for (const [index, node] of graph.nodes.entries()) {
		assertObject(node, `graph.nodes[${index}]`);
		assertString((node as Record<string, unknown>).id, `graph.nodes[${index}].id`);
	}

	for (const [index, link] of graph.links.entries()) {
		assertObject(link, `graph.links[${index}]`);
		assertString((link as Record<string, unknown>).source, `graph.links[${index}].source`);
		assertString((link as Record<string, unknown>).target, `graph.links[${index}].target`);
	}

	return graph;
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
