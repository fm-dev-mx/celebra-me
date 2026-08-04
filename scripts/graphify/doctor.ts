import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { GRAPHIFY_VERSION, computeCorpusHealth } from './corpus.js';
import { normalizeRawGraphDirected, rawEdgeList, validateGraphIntegrity } from './validate.js';

const root = process.cwd();

function run(args: string[], cwd: string): void {
	execFileSync('graphify', args, { cwd, stdio: 'inherit' });
}

function capture(args: string[], cwd: string): string {
	return execFileSync('graphify', args, { cwd, encoding: 'utf8' });
}

function findGraph(outRoot: string): string {
	const candidates = [
		path.join(outRoot, 'graphify-out', 'graph.json'),
		path.join(outRoot, 'graph.json'),
	];
	const found = candidates.find((candidate) => {
		try {
			readFileSync(candidate);
			return true;
		} catch {
			return false;
		}
	});
	if (!found)
		throw new Error('Graphify doctor could not locate graph.json in the temporary output.');
	return found;
}

function runGraphifyDoctor(): void {
	const versionOutput = capture(['--version'], root).trim();
	if (!versionOutput.includes(`graphify ${GRAPHIFY_VERSION}`)) {
		throw new Error(
			`Expected Graphify ${GRAPHIFY_VERSION}; resolved: ${versionOutput || '<unknown>'}.`,
		);
	}

	const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'celebra-graphify-doctor-'));
	try {
		const sourceRoot = path.join(fixtureRoot, 'source');
		const outputRoot = path.join(fixtureRoot, 'output');
		// Keep this fixture outside the repository so the doctor cannot affect the corpus or worktree.
		mkdirForFile(path.join(sourceRoot, 'probe.ts'), "export const probe = 'ok';\n");
		mkdirForFile(
			path.join(sourceRoot, 'probe.sql'),
			'create table graphify_doctor_probe (id bigint primary key);\n',
		);

		run(
			['extract', sourceRoot, '--out', outputRoot, '--code-only', '--force', '--no-cluster'],
			root,
		);
		const graphPath = findGraph(outputRoot);
		const raw = normalizeRawGraphDirected(
			JSON.parse(readFileSync(graphPath, 'utf8')) as Record<string, unknown>,
		);
		const rawEdges = rawEdgeList(raw);
		writeFileSync(graphPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
		const rawHealth = computeCorpusHealth({ 'probe.sql': {} }, { ...raw, links: rawEdges });
		if (rawHealth.sql.filesWithNodes === 0) {
			throw new Error(
				`Graphify SQL extraction is unavailable; install graphifyy[sql]==${GRAPHIFY_VERSION}.`,
			);
		}

		run(['cluster-only', outputRoot, '--no-viz', '--no-label'], root);
		const integrity = validateGraphIntegrity(
			JSON.parse(readFileSync(graphPath, 'utf8')) as Record<string, unknown>,
			{ directed: true },
		);
		if (integrity.linkCount < rawEdges.length) {
			throw new Error(
				`Directed cluster-only lost edges (${rawEdges.length} raw -> ${integrity.linkCount} final).`,
			);
		}
		console.log(
			`Graphify doctor passed: ${versionOutput}; SQL nodes ${rawHealth.sql.nodes}; directed graph ${integrity.nodeCount} nodes/${integrity.linkCount} edges.`,
		);
	} finally {
		rmSync(fixtureRoot, { recursive: true, force: true });
	}
}

function mkdirForFile(filePath: string, contents: string): void {
	const directory = path.dirname(filePath);
	// The fixture path is OS temp state, not repository content.
	mkdirSync(directory, { recursive: true });
	writeFileSync(filePath, contents, 'utf8');
}

try {
	runGraphifyDoctor();
} catch (error) {
	console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
}
