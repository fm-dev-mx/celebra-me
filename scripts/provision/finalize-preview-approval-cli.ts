#!/usr/bin/env node
/** Finalizes a pending Preview approval only with complete hosted evidence. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HostedValidationEvidence, PreviewApprovalArtifact } from './promote-preview-cli.ts';

const REQUIRED_CHECKS = [
	'login',
	'mfaBypass',
	'previewBanner',
	'dashboardListing',
	'editorAndSnapshot',
	'draftAndPublishedContent',
	'publicRouteResponsive',
	'invitationFeatures',
	'previewStorageOnly',
	'preflight',
	'controlledPublication',
	'cleanConsoleAndLogs',
	'noProductionSupabaseRequests',
] as const;

export function finalizePreviewApproval(
	artifact: PreviewApprovalArtifact,
	evidence: HostedValidationEvidence,
): PreviewApprovalArtifact {
	if (artifact.approvalState !== 'pending_hosted_validation') {
		throw new Error(
			`Approval finalization requires pending_hosted_validation; found ${artifact.approvalState}.`,
		);
	}
	if (
		evidence.packageHash !== artifact.packageHash ||
		evidence.previewProjectRef !== artifact.previewProjectRef ||
		evidence.slug !== artifact.slug ||
		evidence.route !== artifact.route ||
		evidence.publishedVersion !== artifact.publishedVersion ||
		evidence.projectionHash !== artifact.projectionHash
	) {
		throw new Error(
			'Hosted validation evidence does not match the pending Preview package, route, version, or projection.',
		);
	}
	if (!/^https:\/\//.test(evidence.deploymentUrl))
		throw new Error('Hosted validation requires an HTTPS Preview deployment URL.');
	if (
		Object.values(evidence.checklistResults).some((passed) => passed !== true) ||
		REQUIRED_CHECKS.some((key) => evidence.checklistResults[key] !== true)
	) {
		throw new Error('Hosted validation checklist is incomplete or has failed checks.');
	}
	if (Object.keys(evidence.storageHashVerification).length === 0)
		throw new Error('Hosted validation requires Storage hash evidence.');
	for (const [storagePath, expectedHash] of Object.entries(artifact.assetHashes)) {
		if (evidence.storageHashVerification[storagePath] !== expectedHash) {
			throw new Error(
				`Hosted validation Storage hash evidence is missing or mismatched for ${storagePath}.`,
			);
		}
	}
	return { ...artifact, approvalState: 'approved', hostedValidation: evidence };
}

export function rejectPreviewApproval(
	artifact: PreviewApprovalArtifact,
	reason: string,
): PreviewApprovalArtifact {
	if (artifact.approvalState !== 'pending_hosted_validation') {
		throw new Error(
			`Approval rejection requires pending_hosted_validation; found ${artifact.approvalState}.`,
		);
	}
	const sanitizedReason = reason
		.replace(/[\r\n]+/g, ' ')
		.trim()
		.slice(0, 500);
	if (!sanitizedReason)
		throw new Error('Approval rejection requires a non-empty sanitized reason.');
	return {
		...artifact,
		approvalState: 'rejected',
		rejection: { rejectedAt: new Date().toISOString(), reason: sanitizedReason },
	};
}

export function parseFinalizerArgs(args: string[]): {
	artifactPath?: string;
	evidencePath?: string;
	rejectReason?: string;
} {
	const artifactIdx = args.indexOf('--artifact');
	const evidenceIdx = args.indexOf('--evidence');
	const rejectIdx = args.indexOf('--reject');
	const artifactPath = artifactIdx !== -1 ? args[artifactIdx + 1] : undefined;
	const evidencePath = evidenceIdx !== -1 ? args[evidenceIdx + 1] : undefined;
	const rejectReason = rejectIdx !== -1 ? args[rejectIdx + 1] : undefined;
	return { artifactPath, evidencePath, rejectReason };
}

function main(): void {
	const args = process.argv.slice(2);
	const { artifactPath, evidencePath, rejectReason } = parseFinalizerArgs(args);
	if (!artifactPath || (!evidencePath && !rejectReason) || (evidencePath && rejectReason)) {
		throw new Error(
			'Usage: --artifact <path> --evidence <path> OR --artifact <path> --reject <reason>.',
		);
	}
	const resolvedArtifact = resolve(process.cwd(), artifactPath);
	const artifact = JSON.parse(readFileSync(resolvedArtifact, 'utf8')) as PreviewApprovalArtifact;
	const finalized = evidencePath
		? finalizePreviewApproval(
				artifact,
				JSON.parse(
					readFileSync(resolve(process.cwd(), evidencePath), 'utf8'),
				) as HostedValidationEvidence,
			)
		: rejectPreviewApproval(artifact, rejectReason!);
	writeFileSync(resolvedArtifact, JSON.stringify(finalized, null, 2), 'utf8');
	console.log(`${finalized.approvalState} Preview artifact: ${resolvedArtifact}`);
}
if (process.argv[1]?.includes('finalize-preview-approval-cli')) main();
