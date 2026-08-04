import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { generateOperationalReports } from './cli.js';
import {
	assertCorpusContract,
	computeCorpusHealth,
	GRAPHIFY_VERSION,
	graphifyIgnoreSha256,
} from './corpus.js';
import { normalizeRawGraphDirected, rawEdgeList, validateGraphIntegrity } from './validate.js';
import { currentHead, sourceFingerprint, type SourceFingerprint } from './source-state.js';

const root = process.cwd();
const refreshRoot = path.join(root, '.agent', 'tmp', 'graphify-refresh');
const generatedRoot = path.join(refreshRoot, 'graphify-out');
const outputRoot = path.join(root, 'graphify-out');

const requiredFiles = [
	'graph.json',
	'manifest.json',
	'.graphify_analysis.json',
	'.graphify_labels.json',
	'.graphify_labels.json.sig',
	'GRAPH_REPORT.md',
] as const;

function run(command: string, args: string[]): void {
	execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

function capture(command: string, args: string[]): string {
	return execFileSync(command, args, { cwd: root, encoding: 'utf8' });
}

function writeJsonAtomic(filePath: string, value: unknown): void {
	const tempPath = `${filePath}.tmp-${process.pid}`;
	writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
	renameSync(tempPath, filePath);
}

function graphifyVersion(): string {
	const version = capture('graphify', ['--version']).trim();
	const match = version.match(/graphify\s+(\d+\.\d+\.\d+)/iu);
	if (!match || match[1] !== GRAPHIFY_VERSION) {
		throw new Error(
			`Graphify ${GRAPHIFY_VERSION} is required; resolved version: ${version || '<unknown>'}.`,
		);
	}
	return match[1];
}

function assertSourceUnchanged(beforeHead: string, beforeFingerprint: SourceFingerprint): void {
	const afterHead = currentHead(root);
	const afterFingerprint = sourceFingerprint(root);
	const changed = [
		beforeHead !== afterHead ? `HEAD ${beforeHead} -> ${afterHead}` : null,
		beforeFingerprint.trackedDiffHash !== afterFingerprint.trackedDiffHash
			? 'tracked worktree diff'
			: null,
		beforeFingerprint.untrackedManifestSha256 !== afterFingerprint.untrackedManifestSha256
			? 'untracked file manifest'
			: null,
		JSON.stringify(beforeFingerprint.untrackedFiles) !==
		JSON.stringify(afterFingerprint.untrackedFiles)
			? 'untracked file list'
			: null,
	].filter(Boolean);
	if (changed.length > 0) {
		throw new Error(
			`Source changed during Graphify extraction; refusing to promote: ${changed.join(', ')}.`,
		);
	}
}

function readJson(filePath: string): Record<string, unknown> {
	return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function runDirectedDiagnostic(graphPath: string, rawEdgeCount: number): Record<string, unknown> {
	const output = capture('graphify', [
		'diagnose',
		'multigraph',
		'--graph',
		graphPath,
		'--json',
		'--directed',
	]);
	const diagnostic = JSON.parse(output) as Record<string, unknown>;
	const summary = (diagnostic.summary ?? {}) as Record<string, unknown>;
	const forbidden = [
		'missing_endpoint_edges',
		'dangling_endpoint_edges',
		'directed_same_endpoint_collapsed_edges',
		'self_loop_edges',
	].filter((key) => Number(summary[key] ?? 0) > 0);
	if (forbidden.length > 0) {
		throw new Error(
			`Directed Graphify diagnostic rejected the raw graph: ${forbidden.join(', ')}.`,
		);
	}
	if (Number(summary.raw_edge_count ?? rawEdgeCount) !== rawEdgeCount) {
		throw new Error(
			`Directed Graphify diagnostic saw ${summary.raw_edge_count ?? '<unknown>'} raw edges; expected ${rawEdgeCount}.`,
		);
	}
	return {
		effectiveDirected: summary.effective_directed === true,
		rawEdgeCount: Number(summary.raw_edge_count ?? rawEdgeCount),
		directedSameEndpointCollapsedEdges: Number(
			summary.directed_same_endpoint_collapsed_edges ?? 0,
		),
		danglingEndpointEdges: Number(summary.dangling_endpoint_edges ?? 0),
	};
}

function listFiles(directory: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...listFiles(absolute));
		else files.push(absolute);
	}
	return files.sort();
}

function promoteFile(source: string, destination: string): void {
	mkdirSync(path.dirname(destination), { recursive: true });
	const temp = `${destination}.tmp-${process.pid}`;
	copyFileSync(source, temp);
	renameSync(temp, destination);
}

function promoteSnapshot(): void {
	const sourceFiles = [
		...requiredFiles.map((file) => path.join(generatedRoot, file)),
		...listFiles(path.join(generatedRoot, 'operational')),
	];
	for (const source of sourceFiles) {
		const relative = path.relative(generatedRoot, source);
		promoteFile(source, path.join(outputRoot, relative));
	}
	const stateSource = path.join(generatedRoot, 'SOURCE_STATE.json');
	if (!existsSync(stateSource))
		throw new Error('SOURCE_STATE.json was not generated in staging.');
	// The state marker is deliberately promoted last: its presence means the snapshot is complete.
	promoteFile(stateSource, path.join(outputRoot, 'SOURCE_STATE.json'));
	const staleHtml = path.join(outputRoot, 'graph.html');
	if (existsSync(staleHtml)) rmSync(staleHtml);
}

export function refreshGraphifySnapshot(): void {
	const beforeHead = currentHead(root);
	const beforeFingerprint = sourceFingerprint(root);
	const ignoreContractSha256 = graphifyIgnoreSha256(root);
	const resolvedVersion = graphifyVersion();

	// This is the only directory this command owns and cleans.
	rmSync(refreshRoot, { recursive: true, force: true });
	mkdirSync(refreshRoot, { recursive: true });

	run('graphify', [
		'extract',
		'.',
		'--out',
		'.agent/tmp/graphify-refresh',
		'--code-only',
		'--force',
		'--max-workers',
		'4',
		'--no-cluster',
	]);
	assertSourceUnchanged(beforeHead, beforeFingerprint);

	const rawGraphPath = path.join(generatedRoot, 'graph.json');
	if (!existsSync(rawGraphPath)) throw new Error('Graphify did not generate a raw graph.json.');
	const rawGraph = normalizeRawGraphDirected(readJson(rawGraphPath));
	const rawEdges = rawEdgeList(rawGraph);
	const rawIntegrity = validateGraphIntegrity(
		{
			...rawGraph,
			links: rawEdges,
		},
		{ directed: true },
	);
	if (rawIntegrity.nodeCount === 0 || rawEdges.length === 0) {
		throw new Error('Graphify raw graph is empty.');
	}
	writeJsonAtomic(rawGraphPath, rawGraph);
	const diagnostic = runDirectedDiagnostic(rawGraphPath, rawEdges.length);
	if (!diagnostic.effectiveDirected)
		throw new Error('Graphify directed diagnostic did not preserve directed=true.');

	run('graphify', ['cluster-only', '.agent/tmp/graphify-refresh', '--no-viz', '--no-label']);
	assertSourceUnchanged(beforeHead, beforeFingerprint);

	for (const file of requiredFiles) {
		if (!existsSync(path.join(generatedRoot, file))) {
			throw new Error(`Graphify did not generate required artifact: ${file}`);
		}
	}
	const graph = readJson(path.join(generatedRoot, 'graph.json'));
	const integrity = validateGraphIntegrity(graph, { directed: true });
	if (integrity.linkCount < rawEdges.length) {
		throw new Error(
			`Graphify cluster-only lost edges (${rawEdges.length} raw -> ${integrity.linkCount} final).`,
		);
	}
	if (integrity.duplicateDirectedPairs > 0) {
		throw new Error(
			`Final directed graph contains ${integrity.duplicateDirectedPairs} colliding endpoint pairs.`,
		);
	}
	if (integrity.nodeCount < 1000 || integrity.linkCount < 1000) {
		throw new Error(
			`Refusing to promote an implausibly small Graphify snapshot (${integrity.nodeCount} nodes, ${integrity.linkCount} edges).`,
		);
	}

	const manifest = readJson(path.join(generatedRoot, 'manifest.json'));
	const corpusHealth = computeCorpusHealth(manifest, graph);
	assertCorpusContract(corpusHealth);

	const analysis = readJson(path.join(generatedRoot, '.graphify_analysis.json'));
	const sourceState = {
		schemaVersion: 2,
		generatedAtUtc: new Date().toISOString(),
		graphifyVersion: resolvedVersion,
		ignoreContractSha256,
		sourceHead: beforeHead,
		trackedDiffHash: beforeFingerprint.trackedDiffHash,
		untrackedManifestSha256: beforeFingerprint.untrackedManifestSha256,
		untrackedFileCount: beforeFingerprint.untrackedFileCount,
		untrackedFiles: beforeFingerprint.untrackedFiles,
		scope: 'Executable architecture: application, tests, scripts, Supabase SQL, and relevant configuration. Documentation, media, public assets, build outputs, local state, dependencies, and Graphify tooling are excluded.',
		commands: [
			'pnpm ops graphify-doctor',
			'pnpm ops graphify-refresh',
			'graphify extract . --out .agent/tmp/graphify-refresh --code-only --force --max-workers 4 --no-cluster',
			'graphify cluster-only .agent/tmp/graphify-refresh --no-viz --no-label',
			'pnpm ops graphify-views',
		],
		corpus: corpusHealth,
		graph: {
			nodes: integrity.nodeCount,
			edges: integrity.linkCount,
			rawEdges: rawEdges.length,
			producerEdges: Number(rawGraph.producer_edge_count ?? rawEdges.length),
			collapsedProducerEdges: Number(rawGraph.collapsed_edge_count ?? 0),
			communities: Object.keys((analysis.communities ?? {}) as Record<string, unknown>)
				.length,
			directed: graph.directed === true,
			duplicateDirectedPairs: integrity.duplicateDirectedPairs,
			diagnostic,
		},
		manifest: 'manifest.json contains the extracted source-file hashes for this snapshot.',
		operationalViews: 'graphify-out/operational was generated from this graph and analysis.',
	};
	writeJsonAtomic(path.join(generatedRoot, 'SOURCE_STATE.json'), sourceState);

	generateOperationalReports({
		graphPath: path.join(generatedRoot, 'graph.json'),
		analysisPath: path.join(generatedRoot, '.graphify_analysis.json'),
		manifestPath: path.join(generatedRoot, 'manifest.json'),
		sourceStatePath: path.join(generatedRoot, 'SOURCE_STATE.json'),
		outputDir: path.join(generatedRoot, 'operational'),
	});
	assertSourceUnchanged(beforeHead, beforeFingerprint);
	promoteSnapshot();
	console.log(
		`Graphify snapshot refreshed: ${integrity.nodeCount} nodes, ${integrity.linkCount} edges.`,
	);
}

if (process.argv[1]?.endsWith(path.join('graphify', 'refresh.ts'))) {
	try {
		refreshGraphifySnapshot();
	} catch (error) {
		console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}
