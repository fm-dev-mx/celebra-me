#!/usr/bin/env node
/**
 * promote-preview-cli.ts — Preview Promotion CLI & Approval Artifact Generator
 *
 * Usage:
 *   pnpm invitation:promote:preview -- --package .tmp/packages/invitation-romina-rios-chaparro-d59c524d18e0.json --dry-run
 *   pnpm invitation:promote:preview -- --package .tmp/packages/invitation-romina-rios-chaparro-d59c524d18e0.json --apply
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { runImportEngine, type ImportEngineResult } from './invitation-import-engine.ts';
import { PREVIEW_SECRET_FILES } from '../db/db-target-config.ts';
import { getSecretFromEnvOrFiles } from '../db/db-guard.ts';

export interface PreviewApprovalArtifact {
	approvalState: 'pending_hosted_validation' | 'approved' | 'rejected';
	packageHash: string;
	slug: string;
	previewProjectRef: string;
	createdAt: string;
	hostedValidation?: HostedValidationEvidence;
	rejection?: { rejectedAt: string; reason: string };
	publishedVersion: number;
	route: string;
	projectionHash: string;
	assetHashes: Record<string, string>;
	checklistStatus: {
		targetVerified: boolean;
		storageHashesMatched: boolean;
		zeroSourceUrls: boolean;
		publicationVerified: boolean;
	};
}

export interface HostedValidationEvidence {
	validatedAt: string;
	deploymentUrl: string;
	previewProjectRef: string;
	packageHash: string;
	slug: string;
	route: string;
	publishedVersion: number;
	projectionHash: string;
	storageHashVerification: Record<string, string>;
	checklistResults: Record<string, boolean>;
}

export function generatePreviewApprovalArtifact(
	result: ImportEngineResult,
	outDir = '.agent/tmp/approvals',
): { artifact: PreviewApprovalArtifact; artifactPath: string } {
	const artifact: PreviewApprovalArtifact = {
		approvalState: 'pending_hosted_validation',
		packageHash: result.packageHash,
		slug: result.slug,
		previewProjectRef: result.projectRef,
		createdAt: new Date().toISOString(),
		publishedVersion: result.publishedVersion,
		route: result.route,
		projectionHash: result.projectionHash,
		assetHashes: result.verifiedAssetHashes,
		checklistStatus: {
			targetVerified: result.projectRef === 'iwipdvisoyerfdytuhwi',
			storageHashesMatched: true,
			zeroSourceUrls: true,
			publicationVerified: result.publishedVersion >= 1,
		},
	};

	const primaryPath = resolve(
		process.cwd(),
		outDir,
		`preview-approval-${result.packageHash.slice(0, 12)}.json`,
	);
	mkdirSync(dirname(primaryPath), { recursive: true });
	writeFileSync(primaryPath, JSON.stringify(artifact, null, 2), 'utf8');

	return { artifact, artifactPath: primaryPath };
}

function parseArgs() {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const apply = args.includes('--apply');
	const allowDivergentOverwrite = args.includes('--allow-divergent-overwrite');
	const pkgIdx = args.indexOf('--package');
	const packagePath = pkgIdx !== -1 ? args[pkgIdx + 1] : null;

	if (!packagePath) {
		console.error('\x1b[31mError: Missing required --package <path> parameter.\x1b[0m\n');
		console.info('Usage:');
		console.info('  pnpm invitation:promote:preview -- --package <path> --dry-run');
		console.info('  pnpm invitation:promote:preview -- --package <path> --apply\n');
		process.exit(1);
	}

	if (!dryRun && !apply) {
		console.error('\x1b[31mError: Specify either --dry-run or --apply.\x1b[0m\n');
		process.exit(1);
	}

	return { packagePath, dryRun: !apply || dryRun, isApply: apply, allowDivergentOverwrite };
}

async function main() {
	const { packagePath, isApply, allowDivergentOverwrite } = parseArgs();

	console.log(`\n\x1b[36m═══ Preview Invitation Promotion ═══\x1b[0m`);
	console.log(`Package: \x1b[1m${packagePath}\x1b[0m`);
	console.log(
		`Mode:    \x1b[1m${isApply ? 'APPLY (importing & publishing to Preview)' : 'DRY RUN'}\x1b[0m\n`,
	);

	const previewDbUrl = getSecretFromEnvOrFiles('PREVIEW_DB_URL', PREVIEW_SECRET_FILES);
	if (!previewDbUrl) {
		console.error(
			'\x1b[31mError: PREVIEW_DB_URL environment variable or secret file is not configured.\x1b[0m\n',
		);
		process.exit(1);
	}

	try {
		const result = await runImportEngine({
			packagePath,
			target: 'preview',
			dryRun: !isApply,
			allowDivergentOverwrite,
			targetDbUrl: previewDbUrl,
		});

		console.log(
			`\x1b[32m✅ Preview promotion ${isApply ? 'completed' : 'dry-run ready'}!\x1b[0m`,
		);
		console.log(`   Package Hash:    \x1b[1m${result.packageHash}\x1b[0m`);
		console.log(`   Route:           \x1b[1m${result.route}\x1b[0m`);
		console.log(`   Project Ref:     ${result.projectRef}`);
		console.log(`   Owner User ID:   ${result.ownerUserId}`);
		console.log(`   Published Ver:   v${result.publishedVersion}`);
		console.log(
			`   Zero-Drift:      ${result.isZeroDriftRerun ? 'Yes (0 mutations performed)' : 'No (mutations applied)'}`,
		);

		console.log('\n   Plan Actions:');
		for (const act of result.actions) {
			const icon = act.action === 'reuse' ? '✓' : act.action === 'create' ? '+' : '~';
			console.log(`     ${icon} [${act.resource}] ${act.name}: ${act.detail}`);
		}

		if (isApply) {
			const { artifactPath } = generatePreviewApprovalArtifact(result);
			console.log(
				`\n   \x1b[33m[approval] Pending hosted-validation artifact generated:\x1b[0m`,
			);
			console.log(`   \x1b[33m${artifactPath}\x1b[0m\n`);
		} else {
			console.log(
				`\n   \x1b[33m[dry-run] Run with --apply to execute Preview import and generate approval artifact.\x1b[0m\n`,
			);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`\n\x1b[31m❌ Preview promotion failed:\x1b[0m ${message}\n`);
		process.exit(1);
	}
}

if (process.argv[1] && process.argv[1].includes('promote-preview-cli')) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
