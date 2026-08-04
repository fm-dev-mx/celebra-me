/**
 * dbs-cli.ts — Read-Only Unified Environment Status CLI (dbs)
 *
 * Usage:
 *   pnpm dbs                   # General 3-environment matrix view
 *   pnpm dbs <slug>            # Per-invitation detailed cross-environment status
 *   pnpm dbs --compact         # Compact CONTENT + SCHEMA (connectivity CONTENT; fast)
 *   pnpm dbs --compact <slug>  # Compact CONTENT + SCHEMA for one invitation
 *   pnpm dbs --compact --aggregate-content  # Worst-of all definitions (slower)
 *   pnpm dbs --json            # JSON output
 */

import { evaluateGeneralStatus, evaluateInvitationStatus } from './dbs-status.ts';
import {
	MANAGED_STATUS_DEFAULT_TIMEOUT_MS,
	runCompactManagedStatusSafe,
} from './managed-status.ts';
import { formatSchemaLifecycleLabel } from '../status-core/schema-lifecycle-contract.ts';

function pad(str: string, width: number): string {
	return str.padEnd(width, ' ');
}

function readTimeoutMs(args: string[]): number {
	const idx = args.indexOf('--timeout-ms');
	if (idx === -1) return MANAGED_STATUS_DEFAULT_TIMEOUT_MS;
	const raw = args[idx + 1];
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 500 || parsed > 60_000) {
		throw new Error('--timeout-ms must be a number between 500 and 60000.');
	}
	return Math.floor(parsed);
}

async function formatGeneralView(jsonMode: boolean): Promise<void> {
	const summary = await evaluateGeneralStatus({ includeManagedCounts: true, concurrency: 3 });
	if (jsonMode) {
		console.log(JSON.stringify(summary, null, 2));
		return;
	}

	const envs = summary.environments;
	console.log(`\n============================================================`);
	console.log(` Celebra-me Unified Environment Status (dbs)`);
	console.log(`============================================================\n`);

	const colW = 16;
	console.log(pad('', 18) + pad('LOCAL', colW) + pad('PREVIEW', colW) + pad('PRODUCTION', colW));
	console.log('-'.repeat(18 + colW * 3));

	const connRow =
		pad('Connection', 18) +
		pad(envs.local.reachable ? 'OK' : 'UNREACHABLE', colW) +
		pad(
			envs.preview.configured
				? envs.preview.reachable
					? 'OK'
					: 'UNREACHABLE'
				: 'NOT_CONFIGURED',
			colW,
		) +
		pad(
			envs.production.configured
				? envs.production.reachable
					? 'OK'
					: 'UNREACHABLE'
				: 'NOT_CONFIGURED',
			colW,
		);
	console.log(connRow);

	const identRow =
		pad('Identity', 18) +
		pad(envs.local.targetClassification.toUpperCase(), colW) +
		pad(envs.preview.targetClassification.toUpperCase(), colW) +
		pad(envs.production.targetClassification.toUpperCase(), colW);
	console.log(identRow);

	const managedRow =
		pad('Managed', 18) +
		pad(String(envs.local.activeManagedCount), colW) +
		pad(String(envs.preview.activeManagedCount), colW) +
		pad(String(envs.production.activeManagedCount), colW);
	console.log(managedRow);

	const conflictsRow =
		pad('Conflicts', 18) +
		pad(String(envs.local.identityConflictsCount), colW) +
		pad(String(envs.preview.identityConflictsCount), colW) +
		pad(String(envs.production.identityConflictsCount), colW);
	console.log(conflictsRow);

	const schemaRow =
		pad('Schema', 18) +
		pad(formatSchemaLifecycleLabel(envs.local.schemaLifecycle ?? 'UNVERIFIED'), colW) +
		pad(formatSchemaLifecycleLabel(envs.preview.schemaLifecycle ?? 'UNVERIFIED'), colW) +
		pad(formatSchemaLifecycleLabel(envs.production.schemaLifecycle ?? 'UNVERIFIED'), colW);
	console.log(schemaRow);
	console.log(
		'(Schema labels use migration_history_parity evidence; object_audit_readiness requires pnpm db:*:audit.)',
	);

	console.log('\nDefinitions in repo:', summary.totalDefinitionsCount);
}

async function formatInvitationView(slug: string, jsonMode: boolean): Promise<void> {
	const summary = await evaluateInvitationStatus(slug);
	if (jsonMode) {
		console.log(JSON.stringify(summary, null, 2));
		return;
	}

	console.log(`\n============================================================`);
	console.log(` Managed Invitation Status: ${summary.title} (${summary.slug})`);
	console.log(` Event Type: ${summary.eventType}`);
	console.log(`============================================================\n`);

	for (const env of ['local', 'preview', 'production'] as const) {
		const res = summary.environments[env];
		console.log(`--- [${env.toUpperCase()}] ---`);
		console.log(`Status:            ${res.status}`);
		console.log(`Active Matches:    ${res.activeMatchCount}`);
		if (res.resolvedId) console.log(`Invitation UUID:   ${res.resolvedId}`);
		if (res.provenanceDefinitionSlug)
			console.log(`Provenance Slug:   ${res.provenanceDefinitionSlug}`);
		if (res.provenancePackageHash)
			console.log(`Package Hash:      ${res.provenancePackageHash.slice(0, 16)}…`);
		if (res.publishedVersion)
			console.log(`Published Version: ${res.publishedVersion} (${res.publishedAt || ''})`);
		if (res.assetCount) console.log(`Assets Count:      ${res.assetCount}`);
		console.log(`Detail:            ${res.detail}\n`);
	}
}

async function formatCompactView(
	slug: string | undefined,
	jsonMode: boolean,
	timeoutMs: number,
	aggregateContent: boolean,
): Promise<void> {
	if (jsonMode) {
		const result = await runCompactManagedStatusSafe({ slug, timeoutMs, aggregateContent });
		if (!result.ok) {
			console.log(
				JSON.stringify({ ok: false, error: result.text.trim(), readOnly: true }, null, 2),
			);
			process.exit(0);
		}
		console.log(JSON.stringify(result.status, null, 2));
		return;
	}

	const result = await runCompactManagedStatusSafe({ slug, timeoutMs, aggregateContent });
	process.stdout.write(result.text);
	if (!result.ok) {
		process.exit(0);
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const jsonMode = args.includes('--json');
	const compactMode = args.includes('--compact');
	const aggregateContent = args.includes('--aggregate-content');
	const timeoutMs = readTimeoutMs(args);
	const timeoutIdx = args.indexOf('--timeout-ms');
	const timeoutValue = timeoutIdx === -1 ? undefined : args[timeoutIdx + 1];
	const slug = args.find(
		(arg, index) =>
			!arg.startsWith('-') &&
			arg !== timeoutValue &&
			!(timeoutIdx !== -1 && index === timeoutIdx + 1),
	);

	if (compactMode) {
		await formatCompactView(slug, jsonMode, timeoutMs, aggregateContent);
		return;
	}

	if (slug) {
		await formatInvitationView(slug, jsonMode);
	} else {
		await formatGeneralView(jsonMode);
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
