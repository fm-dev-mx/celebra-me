#!/usr/bin/env tsx
// =============================================================================
// CELEBRA-ME | Screenshot Tool — CLI Entry Point
// =============================================================================

import * as path from 'node:path';
import * as fs from 'node:fs';
import {
	type CliOptions,
	type PageType,
	type ScreenshotConfigPage,
	type ScreenshotJob,
	DEFAULT_STORAGE_STATE_PATH,
} from './types.js';
import {
	buildJobFromResolvedInvitation,
	resolveScreenshotJobScope,
	resolveScreenshotPlan,
	type ScopeRouteCatalog,
	type ScreenshotScopeRequest,
	ScreenshotScopeError,
} from './scope.js';
import {
	assertInvitationCatalogIntegrity,
	validateScreenshotConfig,
} from './registry-validation.js';
import { assertScreenshotExecutionBudget, summarizeScreenshotPlans } from './execution-policy.js';
import {
	parseCliArgs,
	loadScreenshotConfig,
	createPageSlug,
	resolveScreenshotBaseUrl,
	resolveScreenshotLaneContext,
} from './utils.js';
import { runInteractiveFlow } from './interactive.js';
import { runScreenshotJob } from './runner.js';
import { buildCorpusScreenshotConfig } from '../provision/local-render-corpus/screenshot-pages.ts';
import {
	corpusPublicRoute,
	listLocalRenderCorpus,
	assertLocalRenderCorpusIntegrity,
} from '../provision/local-render-corpus/registry.ts';
import { discoverAllInvitations } from './discovery.js';
import { tryWriteValidationEvidence } from '../observability/validation-evidence.ts';

function knownInvitationCatalog(): ScopeRouteCatalog {
	const discoveredEntries = discoverAllInvitations();
	assertInvitationCatalogIntegrity(discoveredEntries);
	assertLocalRenderCorpusIntegrity();
	const discovered = discoveredEntries.map((invitation) => invitation.route);
	const corpus = listLocalRenderCorpus().map(corpusPublicRoute);
	const invitationRoutes = [...new Set([...discovered, ...corpus])];
	return { invitationRoutes };
}

function printHelp(): void {
	console.log(`
Celebra-me screenshot capture

Direct:
  pnpm screenshot --url=/<eventType>/<slug> [scope options]
  pnpm screenshot:invite --url=/<eventType>/<slug> [scope options]
  pnpm screenshot:local-render-corpus
  pnpm screenshot:interactive

Scope options:
  --type=<page-type>       invitation, landing, dashboard, admin, login, custom
  --target=<preset>        full-page, critical-qa, all-sections, single-section, reveal-only
  --set=<preset>           legacy invitation set mapped to an explicit target
  --general-set=<preset>   legacy general set mapped to an explicit target
  --sections=<ids>         comma-separated registered section IDs, stable-deduplicated
  --viewport=<names>       comma-separated viewport names, stable-deduplicated
  --profile=<profile>      invitation, site, full, single
  --allow-large=true       allow an intentional config batch above the normal budget

Strict behavior:
  Unknown flags, invalid values, unknown routes/sections/viewports, empty selections,
  and corpus plus targeted options fail before Playwright launches.
  --clean removes only exact artifacts and manifests owned by the resolved plan.
  preflight.json is written before capture; report.json is written after execution.
`);
}

function inferPageType(options: CliOptions, route: string, catalog: ScopeRouteCatalog): PageType {
	if (options.pageType) return options.pageType;
	const pathname = new URL(route, resolveScreenshotBaseUrl()).pathname;
	const isInvitation = catalog.invitationRoutes.some(
		(candidate) =>
			new URL(candidate, resolveScreenshotBaseUrl()).pathname ===
			pathname.replace(/\/+$/, ''),
	);
	return isInvitation ? 'invitation' : 'custom';
}

function validateStorageState(authMethod: ScreenshotJob['authMethod'] | undefined): void {
	if (authMethod !== 'storage-state') return;
	const storagePath = path.join(process.cwd(), DEFAULT_STORAGE_STATE_PATH);
	if (!fs.existsSync(storagePath)) {
		throw new ScreenshotScopeError(
			`Storage state file not found: ${storagePath}. Use --auth=none or provide ${DEFAULT_STORAGE_STATE_PATH}.`,
			'MISSING_STORAGE_STATE',
		);
	}
}

function directScopeRequest(
	options: CliOptions,
	baseUrl: string,
	catalog: ScopeRouteCatalog,
): ScreenshotScopeRequest {
	if (!options.url) {
		throw new ScreenshotScopeError(
			`No URL provided. Use --url=<route> or run without flags for interactive mode. Example: pnpm screenshot:invite --url=/boda/<slug>.`,
			'MISSING_URL',
		);
	}
	const pageType = inferPageType(options, options.url, catalog);
	const outputStyle = options.output ? 'custom' : (options.outputStyle ?? 'default');
	return {
		source: 'direct',
		pageType,
		baseUrl,
		routes: [options.url],
		mode: options.mode,
		profile: options.profile,
		viewports: options.viewport,
		target: options.target,
		invitationSet: options.invitationSet,
		generalSet: options.generalSet,
		sections: options.sections,
		includeLayout: options.includeLayout,
		revealHandling: options.reveal,
		animationHandling: options.animation,
		sectionExtent: options.sectionExtent,
		authMethod: options.auth,
		outputFormat: options.format,
		outputFolderStyle: outputStyle,
		outputFolder: options.output,
		clean: options.clean,
	};
}

function buildJobFromCli(options: CliOptions, catalog: ScopeRouteCatalog): ScreenshotJob {
	const laneContext = resolveScreenshotLaneContext({ explicitBaseUrl: options.baseUrl });
	console.log(
		`  Lane:    ${laneContext.displayName} (${laneContext.laneId}) → ${laneContext.baseUrl}` +
			(laneContext.portSource !== 'lane' ? ` [${laneContext.portSource}]` : ''),
	);
	const request = directScopeRequest(options, laneContext.baseUrl, catalog);
	validateStorageState(request.authMethod);
	const plan = resolveScreenshotPlan(request, catalog);
	return buildJobFromResolvedInvitation(plan, plan.invitations[0], request);
}

// eslint-disable-next-line complexity -- Config and corpus defaults are normalized at one resolver boundary.
function configScopeRequest(
	page: ScreenshotConfigPage,
	config: ReturnType<typeof loadScreenshotConfig>,
	options: CliOptions,
	source: 'config' | 'corpus',
	baseUrl: string,
	outputFolder: string | undefined,
): ScreenshotScopeRequest {
	const targetedOptions =
		source === 'corpus'
			? [
					...(options.url ? ['--url'] : []),
					...(options.pageType ? ['--type'] : []),
					...(options.invitationSet || options.generalSet ? ['--set'] : []),
					...(options.sections ? ['--sections'] : []),
					...(options.viewport || options.profile ? ['--viewport/profile'] : []),
					...(options.target ? ['--target'] : []),
					...(options.clean ? ['--clean'] : []),
				]
			: [];
	return {
		source,
		pageType: page.pageType,
		baseUrl,
		routes: [page.route],
		mode: page.mode ?? config.defaultMode ?? options.mode,
		profile: page.profile ?? config.defaultViewportProfile ?? options.profile,
		viewports: page.viewports ?? options.viewport,
		target: page.target ?? options.target,
		invitationSet: page.invitationSet,
		generalSet: page.generalSet,
		sectionCapture: page.sectionCapture,
		sections: page.sections,
		includeLayout: page.includeLayout,
		revealHandling: page.revealHandling,
		animationHandling: page.animationHandling ?? options.animation,
		sectionExtent: page.sectionExtent,
		criticalSelectors: page.criticalSelectors,
		waitSelectors: page.waitSelectors,
		hideSelectors: page.hideSelectors,
		authMethod: page.authMethod,
		outputFormat: page.outputFormat ?? config.defaultOutputFormat,
		outputFolderStyle: outputFolder
			? 'custom'
			: (options.outputStyle ?? config.defaultOutputFolderStyle ?? 'default'),
		outputFolder,
		clean: options.clean,
		targetedOptions,
	};
}

async function runConfigJobs(
	options: CliOptions,
	catalog: ScopeRouteCatalog,
): Promise<{ failed: number; totalPages: number }> {
	const config = options.corpus
		? buildCorpusScreenshotConfig()
		: loadScreenshotConfig(options.config!);
	validateScreenshotConfig(config, options.corpus ? 'Local Render Corpus' : options.config);
	const pages = config.pages ?? [];
	if (pages.length === 0) {
		throw new ScreenshotScopeError(
			options.corpus
				? 'Local Render Corpus has no registered pages.'
				: `Config has no pages: ${options.config}`,
			'EMPTY_CONFIG',
		);
	}

	const preparedJobs = pages.map((page) => {
		const laneContext = resolveScreenshotLaneContext({
			explicitBaseUrl: config.baseUrl ?? options.baseUrl,
		});
		console.log(
			`  Lane:    ${laneContext.displayName} (${laneContext.laneId}) → ${laneContext.baseUrl}` +
				(laneContext.portSource !== 'lane' ? ` [${laneContext.portSource}]` : ''),
		);
		const baseOutput = options.output ?? config.outputDir;
		const outputFolder = baseOutput
			? path.join(baseOutput, createPageSlug(page.route))
			: undefined;
		const request = configScopeRequest(
			page,
			config,
			options,
			options.corpus ? 'corpus' : 'config',
			laneContext.baseUrl,
			outputFolder,
		);
		validateStorageState(request.authMethod);
		const plan = resolveScreenshotPlan(request, catalog);
		const job = buildJobFromResolvedInvitation(plan, plan.invitations[0], request);
		return { job, plan };
	});
	const summary = summarizeScreenshotPlans(preparedJobs.map((entry) => entry.plan));
	console.log(
		`  Execution plan: ${summary.pages} page(s), ${summary.invitations} invitation(s), ${summary.viewports} viewport(s), ${summary.artifacts} planned artifact(s)` +
			(summary.deferredPresetScopes > 0
				? `, ${summary.deferredPresetScopes} preset section scope(s) resolved from rendered DOM`
				: ''),
	);
	assertScreenshotExecutionBudget(summary, {
		source: options.corpus ? 'corpus' : 'config',
		allowLarge: options.allowLarge,
	});

	let failed = 0;
	for (const { job } of preparedJobs) {
		const result = await runScreenshotJob(job);
		if (result.failed > 0) failed++;
	}
	return { failed, totalPages: pages.length };
}

async function main(): Promise<void> {
	const cliOptions = parseCliArgs(process.argv);
	if (cliOptions.help) {
		printHelp();
		return;
	}
	if (cliOptions.corpus && cliOptions.config) {
		throw new ScreenshotScopeError(
			'Use either --corpus or --config, not both.',
			'AMBIGUOUS_SOURCE',
		);
	}

	const catalog = knownInvitationCatalog();
	if (cliOptions.corpus || cliOptions.config) {
		const startedAt = new Date().toISOString();
		const result = await runConfigJobs(cliOptions, catalog);
		if (cliOptions.corpus) {
			const completedAt = new Date().toISOString();
			const total = Math.max(1, result.totalPages);
			const failed = result.failed;
			const writeResult = tryWriteValidationEvidence({
				validationType: 'screenshots',
				command: 'pnpm screenshot:local-render-corpus',
				startedAt,
				completedAt,
				status: failed > 0 ? 'fail' : 'pass',
				total,
				passed: Math.max(0, total - failed),
				failed,
				failures:
					failed > 0
						? [
								{
									slug: 'local-render-corpus',
									message: `${failed} corpus screenshot page(s) failed`,
								},
							]
						: [],
			});
			if (!writeResult.ok)
				console.error(`observability evidence write failed: ${writeResult.error}`);
			else
				console.log(
					`observability evidence written: ${writeResult.snapshot.artifactLocation} (${writeResult.snapshot.status})`,
				);
		}
		if (result.failed > 0) process.exit(1);
		return;
	}

	const isInteractive =
		cliOptions.interactive === true ||
		(cliOptions.interactive === undefined &&
			!cliOptions.url &&
			!Object.keys(cliOptions).some((key) => key !== 'interactive'));
	if (isInteractive) {
		const interactiveJobs = await runInteractiveFlow();
		if (!interactiveJobs) return;
		const rawJobs = Array.isArray(interactiveJobs) ? interactiveJobs : [interactiveJobs];
		const jobs = rawJobs.map((job) => {
			const scopedJob =
				rawJobs.length > 1 && job.outputFolder
					? { ...job, outputFolder: path.join(job.outputFolder, createPageSlug(job.url)) }
					: job;
			validateStorageState(scopedJob.authMethod);
			return resolveScreenshotJobScope(scopedJob, 'interactive', catalog, false).job;
		});
		let failed = 0;
		for (const job of jobs) failed += (await runScreenshotJob(job)).failed;
		if (failed > 0) process.exit(1);
		return;
	}

	const job = buildJobFromCli(cliOptions, catalog);
	const result = await runScreenshotJob(job);
	if (result.failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
	console.error(`\n✕  Fatal error: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
