import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { generateOperationalReports } from './cli.js';

const root = process.cwd();
const refreshRoot = path.join(root, '.agent', 'tmp', 'graphify-refresh');
const generatedRoot = path.join(refreshRoot, 'graphify-out');
const outputRoot = path.join(root, 'graphify-out');

function run(command: string, args: string[]): void {
	execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

function git(args: string[]): string {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function sha256(value: string | Buffer): string {
	return createHash('sha256').update(value).digest('hex');
}

function sourceFingerprint(): {
	trackedDiffHash: string;
	untrackedManifestSha256: string;
	untrackedFileCount: number;
} {
	const trackedDiff = execFileSync(
		'git',
		[
			'diff',
			'--binary',
			'HEAD',
			'--',
			'.',
			':(exclude)graphify-out/**',
			':(exclude).agent/tmp/**',
		],
		{ cwd: root },
	);
	const untracked = git([
		'ls-files',
		'--others',
		'--exclude-standard',
		'--',
		'.',
		':(exclude)graphify-out/**',
		':(exclude).agent/tmp/**',
	])
		.split(/\r?\n/u)
		.filter(Boolean)
		.sort();
	const manifest = untracked
		.map((file) => `${file}\0${sha256(readFileSync(path.join(root, file)))}\n`)
		.join('');
	return {
		trackedDiffHash: sha256(trackedDiff),
		untrackedManifestSha256: sha256(manifest),
		untrackedFileCount: untracked.length,
	};
}

export function refreshGraphifySnapshot(): void {
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
	run('graphify', ['cluster-only', '.agent/tmp/graphify-refresh', '--no-viz', '--no-label']);

	const requiredFiles = [
		'graph.json',
		'manifest.json',
		'.graphify_analysis.json',
		'.graphify_labels.json',
		'.graphify_labels.json.sig',
		'GRAPH_REPORT.md',
	];
	for (const file of requiredFiles) {
		if (!existsSync(path.join(generatedRoot, file))) {
			throw new Error(`Graphify did not generate required artifact: ${file}`);
		}
	}
	const candidateGraph = JSON.parse(
		readFileSync(path.join(generatedRoot, 'graph.json'), 'utf8'),
	) as { nodes?: unknown[]; links?: unknown[] };
	if ((candidateGraph.nodes?.length ?? 0) < 1000 || (candidateGraph.links?.length ?? 0) < 1000) {
		throw new Error(
			`Refusing to promote an implausibly small Graphify snapshot (${candidateGraph.nodes?.length ?? 0} nodes, ${candidateGraph.links?.length ?? 0} edges).`,
		);
	}

	mkdirSync(outputRoot, { recursive: true });
	for (const file of requiredFiles) {
		copyFileSync(path.join(generatedRoot, file), path.join(outputRoot, file));
	}
	const staleHtml = path.join(outputRoot, 'graph.html');
	if (existsSync(staleHtml)) rmSync(staleHtml);

	generateOperationalReports({
		graphPath: path.join(outputRoot, 'graph.json'),
		analysisPath: path.join(outputRoot, '.graphify_analysis.json'),
		outputDir: path.join(outputRoot, 'operational'),
	});

	const graph = JSON.parse(readFileSync(path.join(outputRoot, 'graph.json'), 'utf8')) as {
		nodes: unknown[];
		links: unknown[];
		directed?: boolean;
	};
	const analysis = JSON.parse(
		readFileSync(path.join(outputRoot, '.graphify_analysis.json'), 'utf8'),
	) as { communities?: Record<string, unknown> };
	const sourceState = {
		generatedAtUtc: new Date().toISOString(),
		sourceHead: git(['rev-parse', 'HEAD']),
		...sourceFingerprint(),
		scope: 'Executable architecture only; Markdown, media, public assets, build outputs, agent documentation, and Graphify outputs are excluded.',
		commands: [
			'pnpm ops graphify-refresh',
			'graphify extract . --out .agent/tmp/graphify-refresh --code-only --force --max-workers 4 --no-cluster',
			'graphify cluster-only .agent/tmp/graphify-refresh --no-viz --no-label',
			'pnpm ops graphify-views',
		],
		graph: {
			nodes: graph.nodes.length,
			edges: graph.links.length,
			communities: Object.keys(analysis.communities ?? {}).length,
			directed: graph.directed ?? false,
		},
		manifest: 'manifest.json contains the extracted source-file hashes for this snapshot.',
		operationalViews: 'graphify-out/operational was generated from this graph and analysis.',
	};
	writeFileSync(
		path.join(outputRoot, 'SOURCE_STATE.json'),
		`${JSON.stringify(sourceState, null, 2)}\n`,
	);
	console.log(
		`Graphify snapshot refreshed: ${graph.nodes.length} nodes, ${graph.links.length} edges.`,
	);
}

refreshGraphifySnapshot();
