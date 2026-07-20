#!/usr/bin/env node
/**
 * promote-prod-cli.ts — Production Promotion CLI & Preview Approval Verifier
 *
 * Usage:
 *   pnpm invitation:promote:prod -- --package .tmp/packages/invitation-romina-rios-chaparro-d59c524d18e0.json --owner-user-id <UUID> --dry-run
 *   pnpm invitation:promote:prod -- --package .tmp/packages/invitation-romina-rios-chaparro-d59c524d18e0.json --owner-user-id <UUID> --apply
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runImportEngine } from './invitation-import-engine.ts';
import { getProdDbUrl, redactDbUrl, requireProductionConfirmation } from '../db/db-workflow-lib.ts';
import type { InvitationPackageData } from './invitation-package.ts';
import type { PreviewApprovalArtifact } from './promote-preview-cli.ts';

const REQUIRED_PREVIEW_PROJECT_REF = 'iwipdvisoyerfdytuhwi';

function assertApprovedArtifact(
	artifact: PreviewApprovalArtifact,
	artifactPath: string,
	packageHash: string,
	expectedIdentity?: { slug: string; route: string },
): void {
	if (artifact.approvalState !== 'approved') {
		throw new Error(
			`Preview approval artifact at "${artifactPath}" is ${artifact.approvalState ?? 'legacy/unapproved'}; hosted validation must finalize it as approved.`,
		);
	}
	const hasRequiredIdentity = [
		artifact.previewProjectRef === REQUIRED_PREVIEW_PROJECT_REF,
		Boolean(artifact.slug),
		Boolean(artifact.route),
		Boolean(artifact.projectionHash),
	].every(Boolean);
	if (!hasRequiredIdentity) {
		throw new Error(
			`Preview approval artifact at "${artifactPath}" is missing the required Preview project, route, or projection identity.`,
		);
	}
	const identityMatches =
		!expectedIdentity ||
		[artifact.slug === expectedIdentity.slug, artifact.route === expectedIdentity.route].every(
			Boolean,
		);
	if (!identityMatches) {
		throw new Error(
			`Preview approval artifact at "${artifactPath}" belongs to ${artifact.route}, not the requested package route ${expectedIdentity.route}.`,
		);
	}
	const evidence = artifact.hostedValidation;
	if (!evidence) {
		throw new Error(
			`Preview approval artifact at "${artifactPath}" has missing hosted validation evidence.`,
		);
	}
	const evidenceMatches = [
		evidence.packageHash === packageHash,
		evidence.previewProjectRef === artifact.previewProjectRef,
		evidence.route === artifact.route,
		evidence.projectionHash === artifact.projectionHash,
	].every(Boolean);
	if (!evidenceMatches) {
		throw new Error(
			`Preview approval artifact at "${artifactPath}" has missing or mismatched hosted validation evidence.`,
		);
	}
	const checklistComplete = Object.values(evidence.checklistResults).every(
		(passed) => passed === true,
	);
	const hasStorageEvidence = Object.keys(evidence.storageHashVerification).length > 0;
	if (![checklistComplete, hasStorageEvidence].every(Boolean)) {
		throw new Error(
			`Preview approval artifact at "${artifactPath}" has incomplete hosted validation evidence.`,
		);
	}
}

export function verifyPreviewApprovalArtifact(
	packageHash: string,
	expectedIdentity?: { slug: string; route: string },
	approvalsDirs = ['.agent/tmp/approvals'],
): PreviewApprovalArtifact {
	const shortHash = packageHash.slice(0, 12);
	let artifactPath: string | null = null;

	for (const dir of approvalsDirs) {
		const candidate = resolve(process.cwd(), dir, `preview-approval-${shortHash}.json`);
		if (existsSync(candidate)) {
			artifactPath = candidate;
			break;
		}
	}

	if (!artifactPath) {
		throw new Error(
			`Production promotion safety check failed: No Preview approval artifact found for package hash "${packageHash}". You must promote to Preview first via pnpm invitation:promote:preview -- --package <path> --apply.`,
		);
	}

	let artifact: PreviewApprovalArtifact;
	try {
		artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as PreviewApprovalArtifact;
	} catch {
		throw new Error(
			`Preview approval artifact at "${artifactPath}" is corrupt or invalid JSON.`,
		);
	}

	if (artifact.packageHash !== packageHash) {
		throw new Error(
			`Preview approval artifact hash mismatch: artifact claims "${artifact.packageHash}", expected "${packageHash}".`,
		);
	}
	assertApprovedArtifact(artifact, artifactPath, packageHash, expectedIdentity);

	return artifact;
}

function parseArgs() {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const apply = args.includes('--apply');
	const allowDivergentOverwrite = args.includes('--allow-divergent-overwrite');

	const pkgIdx = args.indexOf('--package');
	const packagePath = pkgIdx >= 0 ? args[pkgIdx + 1] : undefined;

	const ownerIdx = args.indexOf('--owner-user-id');
	const ownerUserId = ownerIdx >= 0 ? args[ownerIdx + 1] : undefined;

	if (!packagePath || !ownerUserId) {
		console.error('\x1b[31mError: Missing required parameters.\x1b[0m\n');
		console.info('Usage:');
		console.info(
			'  pnpm invitation:promote:prod -- --package <path> --owner-user-id <uuid> --dry-run',
		);
		console.info(
			'  pnpm invitation:promote:prod -- --package <path> --owner-user-id <uuid> --apply\n',
		);
		process.exit(1);
	}

	if (!dryRun && !apply) {
		console.error('\x1b[31mError: Specify either --dry-run or --apply.\x1b[0m\n');
		process.exit(1);
	}

	return {
		packagePath,
		ownerUserId,
		dryRun: !apply || dryRun,
		isApply: apply,
		allowDivergentOverwrite,
	};
}

async function main() {
	const { packagePath, ownerUserId, isApply, allowDivergentOverwrite } = parseArgs();

	console.log(`\n\x1b[36m═══ Production Invitation Promotion ═══\x1b[0m`);
	console.log(`Package:       \x1b[1m${packagePath}\x1b[0m`);
	console.log(`Owner User ID: \x1b[1m${ownerUserId}\x1b[0m`);
	console.log(
		`Mode:          \x1b[1m${isApply ? 'APPLY (mutating Production)' : 'DRY RUN'}\x1b[0m\n`,
	);

	// 1. Read package to get packageHash
	if (!existsSync(packagePath)) {
		console.error(`\x1b[31mError: Package file does not exist at "${packagePath}".\x1b[0m\n`);
		process.exit(1);
	}

	const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as InvitationPackageData;

	// 2. Verify matching Preview approval artifact
	console.log(
		`■ Verifying Preview approval artifact for package hash ${pkg.packageHash.slice(0, 12)}…`,
	);
	const approval = verifyPreviewApprovalArtifact(pkg.packageHash, {
		slug: pkg.invitation.slug,
		route: `/${pkg.invitation.eventType}/${pkg.invitation.slug}`,
	});
	console.log(
		`\x1b[32m✅ Preview approval verified!\x1b[0m (Hosted validation: ${approval.hostedValidation?.validatedAt})\n`,
	);

	// 3. Obtain & validate Production DB URL
	const { url: prodDbUrl } = getProdDbUrl();
	console.log(`■ Target Production Database: ${redactDbUrl(prodDbUrl)}`);

	if (isApply) {
		const hostname = new URL(prodDbUrl).hostname;
		console.log('\n■ Prompting for production confirmation…');
		await requireProductionConfirmation(hostname);
		if (allowDivergentOverwrite) {
			console.log(
				'\n■ Divergence override report: this will replace the target draft content and publish a new version. Review the preceding no-override dry-run hashes before confirming.',
			);
			await requireProductionConfirmation(
				hostname,
				`OVERWRITE DIVERGENT INVITATION ${pkg.invitation.slug} ON ${hostname}`,
			);
		}
	}

	try {
		const result = await runImportEngine({
			packagePath,
			target: 'production',
			ownerUserId,
			dryRun: !isApply,
			allowDivergentOverwrite,
			targetDbUrl: prodDbUrl,
		});

		console.log(
			`\x1b[32m✅ Production promotion ${isApply ? 'completed' : 'dry-run ready'}!\x1b[0m`,
		);
		console.log(`   Package Hash:    \x1b[1m${result.packageHash}\x1b[0m`);
		console.log(`   Route:           \x1b[1m${result.route}\x1b[0m`);
		console.log(`   Project Ref:     ${result.projectRef}`);
		console.log(`   Owner User ID:   ${result.ownerUserId}`);
		console.log(`   Published Ver:   v${result.publishedVersion}`);
		console.log(`   Zero-Drift:      ${result.isZeroDriftRerun ? 'Yes' : 'No'}`);

		console.log('\n   Plan Actions:');
		for (const act of result.actions) {
			const icon = act.action === 'reuse' ? '✓' : act.action === 'create' ? '+' : '~';
			console.log(`     ${icon} [${act.resource}] ${act.name}: ${act.detail}`);
		}

		if (!isApply) {
			console.log(
				`\n   \x1b[33m[dry-run] Run with --apply to execute Production promotion after explicit authorization.\x1b[0m\n`,
			);
		} else {
			console.log(
				`\n   \x1b[32m🎉 Production promotion complete! Route: ${result.route}\x1b[0m\n`,
			);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`\n\x1b[31m❌ Production promotion failed:\x1b[0m ${message}\n`);
		process.exit(1);
	}
}

if (process.argv[1] && process.argv[1].includes('promote-prod-cli')) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
