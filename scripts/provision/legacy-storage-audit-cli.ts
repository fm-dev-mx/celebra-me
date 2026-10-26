/** Fixed scope: Preview wedding IDs, global legacy asset counts and Production ID collisions. */
import {
	PREVIEW_LEGACY_STORAGE_SQL,
	buildProductionLegacyStorageSql,
	readLegacyStorageEvidence,
	previewLegacyStorageSchema,
	productionLegacyStorageSchema,
} from './legacy-storage-audit.ts';

async function main(): Promise<void> {
	if (process.argv.slice(2).some((arg) => arg !== '--'))
		throw new Error('This read-only audit accepts no options.');
	const preview = previewLegacyStorageSchema.parse(
		await readLegacyStorageEvidence('preview', PREVIEW_LEGACY_STORAGE_SQL),
	);
	if (preview.assets.length !== preview.liveSupabaseAssets)
		throw new Error('Incomplete Preview asset inventory.');
	const production = productionLegacyStorageSchema.parse(
		await readLegacyStorageEvidence('production', buildProductionLegacyStorageSql(preview)),
	);
	console.log(
		JSON.stringify(
			{ mode: 'read-only', generatedAt: new Date().toISOString(), preview, production },
			null,
			2,
		),
	);
}

main().catch(() => {
	console.error('LEGACY_STORAGE_AUDIT_UNVERIFIED: no complete evidence; no mutations performed.');
	process.exitCode = 1;
});
