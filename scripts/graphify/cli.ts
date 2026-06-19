import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { DEFAULT_GRAPH_PATH, DEFAULT_ANALYSIS_PATH, DEFAULT_OUTPUT_DIR } from './constants.js';
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
	renderOperationalReadme,
} from './render.js';
import { serializeStableJson } from './serialize.js';

function readJson(filePath: string): Record<string, unknown> {
	return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

export function generateOperationalReports({
	graphPath = DEFAULT_GRAPH_PATH,
	analysisPath = DEFAULT_ANALYSIS_PATH,
	outputDir = DEFAULT_OUTPUT_DIR,
} = {}) {
	const graph = validateGraphShape(readJson(graphPath));
	const analysis = validateAnalysisShape(readJson(analysisPath));
	const indexes = buildGraphIndexes(graph, analysis);
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
	writeFileSync(
		path.join(outputDir, 'community-summary.json'),
		serializeStableJson(communitySummary),
	);
	writeFileSync(
		path.join(outputDir, 'community-summary.md'),
		renderCommunitySummaryMarkdown(communitySummary),
	);
	writeFileSync(path.join(outputDir, 'risk-hubs.json'), serializeStableJson(riskHubs));
	writeFileSync(path.join(outputDir, 'risk-hubs.md'), renderRiskHubsMarkdown(riskHubs));
	writeFileSync(path.join(outputDir, 'cleanup-report.json'), serializeStableJson(cleanupReport));
	writeFileSync(path.join(outputDir, 'cleanup-report.md'), renderCleanupMarkdown(cleanupReport));
	writeFileSync(path.join(outputDir, 'domain-rsvp.json'), serializeStableJson(rsvpDomainReport));
	writeFileSync(
		path.join(outputDir, 'domain-rsvp.md'),
		renderRsvpDomainMarkdown(rsvpDomainReport),
	);
	writeFileSync(
		path.join(outputDir, 'domain-intake-publishing.json'),
		serializeStableJson(intakePublishingDomainReport),
	);
	writeFileSync(
		path.join(outputDir, 'domain-intake-publishing.md'),
		renderIntakePublishingDomainMarkdown(intakePublishingDomainReport),
	);
	writeFileSync(
		path.join(outputDir, 'domain-invitation-rendering.json'),
		serializeStableJson(invitationRenderingDomainReport),
	);
	writeFileSync(
		path.join(outputDir, 'domain-invitation-rendering.md'),
		renderInvitationRenderingDomainMarkdown(invitationRenderingDomainReport),
	);
	writeFileSync(
		path.join(outputDir, 'domain-theme-assets.json'),
		serializeStableJson(themeAssetsDomainReport),
	);
	writeFileSync(
		path.join(outputDir, 'domain-theme-assets.md'),
		renderThemeAssetsDomainMarkdown(themeAssetsDomainReport),
	);
	writeFileSync(path.join(outputDir, 'README.md'), renderOperationalReadme(communitySummary));

	return {
		outputDir,
		files: [
			'README.md',
			'community-summary.json',
			'community-summary.md',
			'risk-hubs.json',
			'risk-hubs.md',
			'cleanup-report.json',
			'cleanup-report.md',
			'domain-rsvp.json',
			'domain-rsvp.md',
			'domain-intake-publishing.json',
			'domain-intake-publishing.md',
			'domain-invitation-rendering.json',
			'domain-invitation-rendering.md',
			'domain-theme-assets.json',
			'domain-theme-assets.md',
		].map((file) => path.join(outputDir, file)),
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
		} else if (arg === '--help' || arg === '-h') {
			console.log(
				'Usage: pnpm ops graphify-views [--graph path] [--analysis path] [--out path]',
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
