/**
 * Draft canonicalization repair CLI.
 *
 * Read-only dry-run by default. `--apply` writes the canonical draft document in
 * a single transaction; Production additionally requires a fresh critical backup
 * manifest and interactive owner confirmation. Published content is never
 * written and the invitation is never published.
 *
 * Usage:
 *   pnpm invitation:draft-canonicalize --slug <slug> [--target local|preview|production] [--json]
 *   pnpm invitation:draft-canonicalize --slug <slug> --target production --apply --backup-manifest <path>
 */
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { requireOwnerProductionApply } from '../db/owner-production-apply.ts';
import {
	clearProductionWritePermit,
	withProductionPermitScope,
} from '../db/production-write-permit.ts';
import {
	buildDraftCanonicalizationPlan,
	DRAFT_CANONICALIZATION_OPERATION_TYPE,
	verifyDraftCanonicalizationOutcome,
	type DraftCanonicalizationPlan,
	type DraftCanonicalizationTarget,
} from './draft-canonicalization.ts';
import {
	applyDraftCanonicalization,
	readDraftCanonicalizationState,
	resolveTargetDbUrl,
} from './draft-canonicalization-service.ts';
import { evaluatePromotionBackupGate } from './invitation-promote.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const apply = args.includes('--apply');

function value(flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function requireSlug(): string {
	const slug = value('--slug');
	if (!slug || slug.startsWith('--')) {
		throw new Error('SLUG_REQUIRED: pass --slug <invitation-slug>.');
	}
	return slug;
}

function requireTarget(): DraftCanonicalizationTarget {
	const target = value('--target') ?? 'local';
	if (target !== 'local' && target !== 'preview' && target !== 'production') {
		throw new Error('TARGET_INVALID: --target must be local, preview or production.');
	}
	return target;
}

function loadPlan(): { plan: DraftCanonicalizationPlan; dbUrl: string } {
	const slug = requireSlug();
	const target = requireTarget();
	const dbUrl = resolveTargetDbUrl(target);
	const state = readDraftCanonicalizationState(slug, dbUrl);
	if (!state?.draft.content) {
		throw new Error(`DRAFT_NOT_FOUND: no active draft for ${slug} in ${target}.`);
	}
	const plan = buildDraftCanonicalizationPlan({
		target,
		slug,
		draftContent: state.draft.content,
		publishedContent: state.published.content,
		draftStatus: state.draft.status,
		draftUpdatedAt: state.draft.updatedAt,
		publishedVersion: state.published.version,
	});
	return { plan, dbUrl };
}

function printPlan(plan: DraftCanonicalizationPlan): void {
	if (json) {
		console.log(JSON.stringify(plan, null, 2));
		return;
	}
	console.log(`Draft canonicalization — read-only dry-run (${plan.target}/${plan.slug})`);
	console.log(`Writes: ${plan.writes}; already canonical: ${plan.alreadyCanonical}`);
	console.log(`Published version: ${plan.publishedVersion}; hash: ${plan.hashes.published}`);
	console.log(`Draft before: ${plan.hashes.draftBefore}`);
	console.log(`Draft after:  ${plan.hashes.draftAfter}`);
	console.log(
		`Removed published-only keys (${plan.removedPublishedOnlyKeys.length}): ${plan.removedPublishedOnlyKeys.join(', ') || 'none'}`,
	);
	console.log(
		`Structural paths normalized (${plan.structuralChangedPaths.length}): ${plan.structuralChangedPaths.join(', ') || 'none'}`,
	);
	console.log(
		`Draft edits preserved vs published (${plan.preservedDraftChanges.length}): ${plan.preservedDraftChanges.join(', ') || 'none'}`,
	);
	console.log(
		`Sections with unpublished draft differences (draft-side): ${plan.draftDivergenceSections.map((section) => `${section.sectionLabel} (${section.sectionKey})`).join(', ') || 'none'}`,
	);
	console.log(
		`Effective editor/preview/publish content unchanged: ${plan.effectiveContentUnchanged}`,
	);
	console.log(`Operation fingerprint: ${plan.operationFingerprint}`);
	console.log('Published content will not be written. The invitation will not be published.');
}

async function authorizeProduction(plan: DraftCanonicalizationPlan, dbUrl: string): Promise<void> {
	const backupManifestPath = value('--backup-manifest');
	if (!backupManifestPath) {
		throw new Error(
			'BACKUP_REQUIRED: pass --backup-manifest from a fresh pnpm db:prod:backup:critical run before applying in Production.',
		);
	}
	const backup = evaluatePromotionBackupGate({
		manifestPath: backupManifestPath,
		productionProjectRef: SUPABASE_PROJECT_REFS.production,
		required: true,
	});
	if (!backup.acceptable) throw new Error(backup.detail);

	await requireOwnerProductionApply({
		apply: true,
		dbUrl,
		operationType: DRAFT_CANONICALIZATION_OPERATION_TYPE,
		operationVerb: 'CANON',
		bindingHex: plan.operationFingerprint,
		applyActionLabel: 'Aplicar',
		summaryTitle: 'Canonicalización de borrador — Production',
		summary: [
			['Operación', 'Normalización estructural del borrador'],
			['Invitación', plan.slug],
			['Cambios del anfitrión', 'Se conservan sin modificación'],
			['Publicación', 'No se publica ni se modifica el contenido publicado'],
		],
		technicalReview: [
			['Impacto', 'Reescribe el documento del borrador al contrato plano canónico'],
			['Contenido efectivo', 'Idéntico antes y después (verificado)'],
			['Huella', plan.operationFingerprint],
			['Operation ID', plan.operationId],
			['Controles', 'TTY · agente bloqueado · backup · transacción única'],
		],
	});
}

async function applyPlan(): Promise<void> {
	const { plan, dbUrl } = loadPlan();
	if (plan.alreadyCanonical) {
		printPlan(plan);
		console.log('Draft is already canonical; no write required.');
		return;
	}
	const requestedFingerprint = value('--operation-fingerprint');
	if (requestedFingerprint && requestedFingerprint !== plan.operationFingerprint) {
		throw new Error(
			'DRAFT_CANONICALIZATION_FINGERPRINT_MISMATCH: supplied fingerprint differs from the current dry-run.',
		);
	}
	const isProduction = plan.target === 'production';
	if (isProduction) await authorizeProduction(plan, dbUrl);

	try {
		const state = readDraftCanonicalizationState(plan.slug, dbUrl);
		if (!state?.draft.content || !state.published.content) {
			throw new Error('DRAFT_CANONICALIZATION_STATE_UNAVAILABLE: re-read returned no state.');
		}
		const draftContent = state.draft.content;
		const publishedContent = state.published.content;
		if (state.draft.updatedAt !== plan.draftUpdatedAt) {
			throw new Error(
				'DRAFT_CANONICALIZATION_STALE_STATE: draft was updated during authorization.',
			);
		}
		const applyCanonicalization = () =>
			applyDraftCanonicalization({
				plan,
				beforeContent: draftContent,
				publishedContent,
				targetDbUrl: dbUrl,
			});
		const applied = isProduction
			? withProductionPermitScope(
					{
						bindingHex: plan.operationFingerprint,
						operationType: DRAFT_CANONICALIZATION_OPERATION_TYPE,
					},
					applyCanonicalization,
				)
			: applyCanonicalization();
		verifyDraftCanonicalizationOutcome(plan, applied.draftContent, applied.publishedContent);

		const verification = loadPlan();
		const summary = {
			status: applied.status,
			operationId: plan.operationId,
			operationFingerprint: plan.operationFingerprint,
			draftAfter: plan.hashes.draftAfter,
			alreadyCanonical: verification.plan.alreadyCanonical,
			draftDivergenceSections: verification.plan.draftDivergenceSections,
			transaction: 'committed',
		};
		if (json) console.log(JSON.stringify(summary, null, 2));
		else {
			console.log(
				`Draft canonicalization ${applied.status} for ${plan.slug} (${plan.target}).`,
			);
			console.log(
				`Sections with unpublished draft differences: ${verification.plan.draftDivergenceSections.map((section) => section.sectionLabel).join(', ') || 'none'}`,
			);
		}
	} finally {
		if (isProduction) clearProductionWritePermit();
	}
}

void (async () => {
	try {
		if (apply) await applyPlan();
		else printPlan(loadPlan().plan);
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
})();
