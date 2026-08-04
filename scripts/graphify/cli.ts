import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
	DEFAULT_ANALYSIS_PATH,
	DEFAULT_GRAPH_PATH,
	DEFAULT_MANIFEST_PATH,
	DEFAULT_OUTPUT_DIR,
	DEFAULT_SOURCE_STATE_PATH,
} from './constants.js';
import { assertCorpusContract, computeCorpusHealth, graphifyIgnoreSha256 } from './corpus.js';
import { assertSourceStateFresh } from './source-state.js';
import { validateGraphShape, validateAnalysisShape } from './validate.js';
import { buildGraphIndexes } from './core.js';
import {
	computeCommunitySummary,
	computeRiskHubs,
	computeCleanupReport,
	computeRsvpDomainReport,
	computeIntakePublishingDomainReport,
	computeInvitationRenderingDomainReport,
	computeThemeAssetsDomainReport,
} from './reports.js';
import {
	renderCommunitySummaryMarkdown,
	renderRiskHubsMarkdown,
	renderCleanupMarkdown,
	renderRsvpDomainMarkdown,
	renderIntakePublishingDomainMarkdown,
	renderInvitationRenderingDomainMarkdown,
	renderThemeAssetsDomainMarkdown,
	renderCorpusHealthMarkdown,
	renderOperationalReadme,
} from './render.js';
import { serializeStableJson } from './serialize.js';

const REPORT_NAMES = [
	'community-summary',
	'risk-hubs',
	'cleanup-report',
	'domain-rsvp',
	'domain-intake-publishing',
	'domain-invitation-rendering',
	'domain-theme-assets',
	'corpus-health',
] as const;

export interface GenerateOperationalReportsOptions {
	graphPath?: string;
	analysisPath?: string;
	outputDir?: string;
	manifestPath?: string;
	sourceStatePath?: string;
}

function writePair<T>(outputDir: string, name: string, data: T, render: (data: T) => string) {
	writeFileSync(path.join(outputDir, `${name}.json`), serializeStableJson(data));
	writeFileSync(path.join(outputDir, `${name}.md`), render(data));
}

export function requireFreshGraph(
	graphCommit: string | null | undefined,
	headCommit: string,
): void {
	const display = graphCommit ?? '<missing>';
	if (!graphCommit || graphCommit !== headCommit) {
		throw new Error(
			[
				'Graphify raw graph is stale.',
				'',
				`Raw graph commit: ${display}`,
				`Current HEAD: ${headCommit}`,
				'',
				'Regenerate the raw Graphify graph before running operational views.',
				'Canonical refresh:',
				'pnpm ops graphify-refresh',
				'',
				'Then regenerate operational views if needed:',
				'pnpm ops graphify-views',
				'',
				'Advanced (usually unnecessary; prefer the canonical command):',
				'graphify extract . --out .agent/tmp/graphify-refresh',
				'graphify cluster-only .agent/tmp/graphify-refresh --no-viz --no-label',
			].join('\n'),
		);
	}
}

export function generateOperationalReports({
	graphPath = DEFAULT_GRAPH_PATH,
	analysisPath = DEFAULT_ANALYSIS_PATH,
	outputDir = DEFAULT_OUTPUT_DIR,
	manifestPath,
	sourceStatePath,
}: GenerateOperationalReportsOptions = {}) {
	const requiresSnapshotState = sourceStatePath !== undefined || graphPath === DEFAULT_GRAPH_PATH;
	const resolvedManifestPath =
		manifestPath ?? (requiresSnapshotState ? DEFAULT_MANIFEST_PATH : undefined);
	const resolvedSourceStatePath =
		sourceStatePath ?? (requiresSnapshotState ? DEFAULT_SOURCE_STATE_PATH : undefined);
	const graph = validateGraphShape(
		JSON.parse(readFileSync(graphPath, 'utf8')) as Record<string, unknown>,
	);
	requireFreshGraph(
		graph.built_at_commit as string | null | undefined,
		execSync('git rev-parse HEAD').toString().trim(),
	);
	if (resolvedSourceStatePath) {
		if (!existsSync(resolvedSourceStatePath)) {
			throw new Error(`Graphify source state is missing: ${resolvedSourceStatePath}`);
		}
		const sourceState = JSON.parse(readFileSync(resolvedSourceStatePath, 'utf8')) as Record<
			string,
			unknown
		>;
		assertSourceStateFresh(sourceState, process.cwd(), graphifyIgnoreSha256(process.cwd()));
	}
	const analysis = validateAnalysisShape(
		JSON.parse(readFileSync(analysisPath, 'utf8')) as Record<string, unknown>,
	);
	const indexes = buildGraphIndexes(graph, analysis);
	const manifest =
		resolvedManifestPath && existsSync(resolvedManifestPath)
			? JSON.parse(readFileSync(resolvedManifestPath, 'utf8'))
			: {};
	const corpusHealth = computeCorpusHealth(manifest, graph);
	if (requiresSnapshotState) assertCorpusContract(corpusHealth);
	const options = { sourceGraphPath: graphPath.replaceAll('\\', '/') };

	const communitySummary = computeCommunitySummary(graph, analysis, indexes, options);
	const riskHubs = computeRiskHubs(graph, indexes, options);
	const cleanupReport = computeCleanupReport(graph, analysis, indexes, options);
	const rsvpDomainReport = computeRsvpDomainReport(graph, analysis, indexes, options);
	const intakePublishingDomainReport = computeIntakePublishingDomainReport(
		graph,
		analysis,
		indexes,
		options,
	);
	const invitationRenderingDomainReport = computeInvitationRenderingDomainReport(
		graph,
		analysis,
		indexes,
		options,
	);
	const themeAssetsDomainReport = computeThemeAssetsDomainReport(
		graph,
		analysis,
		indexes,
		options,
	);

	mkdirSync(outputDir, { recursive: true });
	writePair(outputDir, 'community-summary', communitySummary, renderCommunitySummaryMarkdown);
	writePair(outputDir, 'risk-hubs', riskHubs, renderRiskHubsMarkdown);
	writePair(outputDir, 'cleanup-report', cleanupReport, renderCleanupMarkdown);
	writePair(outputDir, 'domain-rsvp', rsvpDomainReport, renderRsvpDomainMarkdown);
	writePair(
		outputDir,
		'domain-intake-publishing',
		intakePublishingDomainReport,
		renderIntakePublishingDomainMarkdown,
	);
	writePair(
		outputDir,
		'domain-invitation-rendering',
		invitationRenderingDomainReport,
		renderInvitationRenderingDomainMarkdown,
	);
	writePair(
		outputDir,
		'domain-theme-assets',
		themeAssetsDomainReport,
		renderThemeAssetsDomainMarkdown,
	);
	writePair(outputDir, 'corpus-health', corpusHealth, renderCorpusHealthMarkdown);
	writeFileSync(path.join(outputDir, 'README.md'), renderOperationalReadme(communitySummary));

	return {
		outputDir,
		files: [
			path.join(outputDir, 'README.md'),
			...REPORT_NAMES.flatMap((name) => [
				path.join(outputDir, `${name}.json`),
				path.join(outputDir, `${name}.md`),
			]),
		],
	};
}

export function parseArgs(argv: string[]) {
	const options: Record<string, string> = {};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--graph') {
			options.graphPath = argv[index + 1];
			index += 1;
		} else if (arg === '--analysis') {
			options.analysisPath = argv[index + 1];
			index += 1;
		} else if (arg === '--out') {
			options.outputDir = argv[index + 1];
			index += 1;
		} else if (arg === '--manifest') {
			options.manifestPath = argv[index + 1];
			index += 1;
		} else if (arg === '--source-state') {
			options.sourceStatePath = argv[index + 1];
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			console.log(
				'Usage: pnpm ops graphify-views [--graph path] [--analysis path] [--manifest path] [--source-state path] [--out path]',
			);
			process.exit(0);
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}
	return options;
}

export function runCli() {
	const result = generateOperationalReports(parseArgs(process.argv.slice(2)));
	console.log(`Graphify operational reports written to ${result.outputDir}`);
	for (const file of result.files) {
		console.log(`- ${file}`);
	}
}
