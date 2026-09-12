/** Owner-only image namespace migration through the canonical prod:apply entrypoint. */
import { createHash } from 'node:crypto';
import { assertProductionDbUrl, getProdDbUrl, runPsql } from './db-workflow-lib.ts';
import {
	ensureCriticalProductionBackup,
	revalidateCriticalProductionBackup,
} from './critical-production-backup.ts';
import { requireOwnerProductionApply } from './owner-production-apply.ts';
import {
	clearProductionWritePermit,
	withProductionPermitScope,
} from './production-write-permit.ts';
import {
	applyRemoteMigration,
	fingerprint,
	readMigrationManifest,
	readSnapshot,
} from '../invitation/image-namespace-migration-cli.ts';
import { buildNamespaceRollbackSql } from '../invitation/image-namespace-remap.ts';

export async function runProductionImageNamespaceApply(input: {
	manifestPath: string;
	apply: boolean;
	rollback: boolean;
}): Promise<void> {
	const plan = readMigrationManifest(input.manifestPath);
	if (plan.target !== 'production')
		throw new Error('Only Production manifests can use prod:apply.');
	const dbUrl = getProdDbUrl().url;
	assertProductionDbUrl(dbUrl);
	const snapshot = readSnapshot('production', plan.slug, dbUrl);
	if (snapshot.invitationId !== plan.before.invitationId)
		throw new Error('Production invitation identity changed.');
	if (!input.rollback) {
		if (fingerprint(snapshot) !== plan.snapshotHash)
			throw new Error('Production manifest is stale; regenerate and review it.');
	} else {
		buildNamespaceRollbackSql(plan.before, plan.swaps, plan.retirements);
	}
	const binding = input.rollback
		? createHash('sha256').update(`${plan.planId}:rollback`).digest('hex')
		: plan.planId;
	process.stdout.write(
		`${input.rollback ? 'Rollback' : 'Migration'} Production/${plan.slug}: ` +
			`${plan.swaps.length} copied images, ${plan.retirements.length} retired rows; plan ${binding.slice(0, 8)}.\n`,
	);
	if (!input.apply) return;
	const backup = ensureCriticalProductionBackup({
		prodDbUrl: dbUrl,
		purpose: 'standalone',
		planId: binding,
		reuseExisting: true,
		retryCommand: 'pnpm prod:apply',
		operationLabel: 'la migración de imágenes',
	});
	try {
		await requireOwnerProductionApply({
			apply: true,
			dbUrl,
			operationType: 'production_apply',
			operationVerb: 'APPLY',
			bindingHex: binding,
			applyActionLabel: input.rollback ? 'Revertir imágenes' : 'Migrar imágenes',
			summaryTitle: 'Migración de imágenes Production',
			summary: [
				['Invitación', plan.slug],
				['Operación', input.rollback ? 'Rollback' : 'Migración'],
				['Imágenes', String(plan.swaps.length)],
				['Plan', binding],
			],
		});
		revalidateCriticalProductionBackup({
			prodDbUrl: dbUrl,
			manifestPath: backup.manifestPath,
			retryCommand: 'pnpm prod:apply',
		});
		await withProductionPermitScope(
			{ bindingHex: binding, operationType: 'production_apply' },
			async () => {
				if (input.rollback) {
					runPsql(
						buildNamespaceRollbackSql(plan.before, plan.swaps, plan.retirements),
						dbUrl,
						{
							throwOnError: true,
						},
					);
					return;
				}
				await applyRemoteMigration(plan, snapshot, dbUrl);
			},
		);
	} finally {
		clearProductionWritePermit();
	}
}
