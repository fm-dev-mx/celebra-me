/** Owner-only R2 media migration through the canonical prod:apply entrypoint. */
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
	applyR2Migration,
	buildR2RollbackSql,
	fingerprintR2Snapshot,
	r2RemapOptions,
	readR2MigrationManifest,
	readR2Snapshot,
} from '../invitation/image-r2-migration-cli.ts';
import { buildNamespaceRemapSql } from '../invitation/image-namespace-remap.ts';

export async function runProductionImageR2Apply(input: {
	manifestPath: string;
	apply: boolean;
	rollback: boolean;
}): Promise<void> {
	const plan = readR2MigrationManifest(input.manifestPath);
	if (plan.target !== 'production')
		throw new Error('Only Production manifests can use prod:apply.');
	const dbUrl = getProdDbUrl().url;
	assertProductionDbUrl(dbUrl);
	const snapshot = readR2Snapshot('production', plan.slug, dbUrl);
	if (snapshot.invitationId !== plan.before.invitationId)
		throw new Error('Production invitation identity changed.');
	if (!input.rollback) {
		if (fingerprintR2Snapshot(snapshot) !== plan.snapshotHash)
			throw new Error('Production manifest is stale; regenerate and review it.');
		buildNamespaceRemapSql(snapshot, plan.swaps, [], r2RemapOptions(plan));
	} else {
		buildR2RollbackSql(plan);
	}
	const binding = input.rollback
		? createHash('sha256').update(`${plan.planId}:rollback`).digest('hex')
		: plan.planId;
	process.stdout.write(
		`${input.rollback ? 'Rollback' : 'Migration'} Production/${plan.slug} to R2: ` +
			`${plan.swaps.length} images, ${plan.urlSwaps.length} audio files, ` +
			`${plan.objects.length} R2 objects; plan ${binding.slice(0, 8)}.\n`,
	);
	if (!input.apply) return;
	const backup = ensureCriticalProductionBackup({
		prodDbUrl: dbUrl,
		purpose: 'standalone',
		planId: binding,
		reuseExisting: true,
		retryCommand: 'pnpm prod:apply',
		operationLabel: 'la migración de imágenes a R2',
	});
	try {
		await requireOwnerProductionApply({
			apply: true,
			dbUrl,
			operationType: 'production_apply',
			operationVerb: 'APPLY',
			bindingHex: binding,
			applyActionLabel: input.rollback ? 'Revertir imágenes R2' : 'Migrar imágenes a R2',
			summaryTitle: 'Migración de imágenes a R2 Production',
			summary: [
				['Invitación', plan.slug],
				['Operación', input.rollback ? 'Rollback' : 'Migración'],
				['Imágenes', String(plan.swaps.length)],
				['Audio', String(plan.urlSwaps.length)],
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
					runPsql(buildR2RollbackSql(plan), dbUrl, { throwOnError: true });
					return;
				}
				await applyR2Migration(plan, snapshot, dbUrl);
			},
		);
	} finally {
		clearProductionWritePermit();
	}
}
