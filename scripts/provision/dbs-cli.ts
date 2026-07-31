/**
 * dbs-cli.ts — Read-Only Unified Environment Status CLI (dbs)
 *
 * Usage:
 *   pnpm dbs                   # General 3-environment matrix view
 *   pnpm dbs <slug>            # Per-invitation detailed cross-environment status
 *   pnpm dbs --json            # JSON output
 */

import { evaluateGeneralStatus, evaluateInvitationStatus } from './dbs-status.ts';

function pad(str: string, width: number): string {
	return str.padEnd(width, ' ');
}

function formatGeneralView(jsonMode: boolean): void {
	const summary = evaluateGeneralStatus();
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
		pad(envs.local.schemaLifecycle ?? 'UNVERIFIED', colW) +
		pad(envs.preview.schemaLifecycle ?? 'UNVERIFIED', colW) +
		pad(envs.production.schemaLifecycle ?? 'UNVERIFIED', colW);
	console.log(schemaRow);

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

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const jsonMode = args.includes('--json');
	const nonFlagArgs = args.filter((a) => !a.startsWith('-'));

	const slug = nonFlagArgs[0];
	if (slug) {
		await formatInvitationView(slug, jsonMode);
	} else {
		formatGeneralView(jsonMode);
	}
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
