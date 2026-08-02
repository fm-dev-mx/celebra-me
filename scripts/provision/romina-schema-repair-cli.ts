import { buildRominaSchemaRepairPlan, ROMINA_SCHEMA_REPAIR_SLUG } from './romina-schema-repair.ts';
import { readLegacyAdoptionCandidate } from './legacy-baseline-adoption.ts';

const args = new Set(process.argv.slice(2));
const json = args.has('--json');

if (args.has('--apply')) {
	console.error(
		'ROMINA_REPAIR_APPLY_DISABLED: this task permits only a read-only dry-run; no Production repair can be applied.',
	);
	process.exitCode = 1;
} else {
	const candidate = readLegacyAdoptionCandidate({
		environment: 'production',
		slug: ROMINA_SCHEMA_REPAIR_SLUG,
	});
	if (!candidate?.draft.content || !candidate.published.content) {
		console.error(
			'ROMINA_REPAIR_PRODUCTION_UNAVAILABLE: complete Production evidence is required.',
		);
		process.exitCode = 1;
	} else {
		try {
			const plan = buildRominaSchemaRepairPlan({
				slug: ROMINA_SCHEMA_REPAIR_SLUG,
				draftContent: candidate.draft.content as Record<string, unknown>,
				publishedContent: candidate.published.content as Record<string, unknown>,
				draftStatus: candidate.draft.status,
				draftUpdatedAt: candidate.draft.updatedAt,
				publishedVersion: candidate.published.version,
			});
			if (json) {
				console.log(JSON.stringify(plan, null, 2));
			} else {
				console.log('Romina schema repair — read-only dry-run');
				console.log(`Target: ${plan.target}; slug: ${plan.slug}; writes: ${plan.writes}`);
				console.log(`Changed paths: ${plan.changedPaths.join(', ')}`);
				console.log(`Before hash: ${plan.hashes.before}`);
				console.log(`After hash:  ${plan.hashes.after}`);
				console.log('No database write was attempted. Apply is explicitly disabled.');
			}
		} catch (error: unknown) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	}
}
