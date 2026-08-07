/**
 * Draft restore CLI — facade over `planDraftRestore`.
 *
 * Dry-run by default. Content transformation always comes from
 * `src/lib/intake/services/draft-restore.service.ts`. Persistence for apply
 * writes that planned document with optimistic concurrency; Production also
 * requires backup + interactive owner confirmation.
 *
 * Usage:
 *   pnpm invitation:draft-restore --slug <slug> --section family [--target local|preview|production]
 *   pnpm invitation:draft-restore --slug <slug> --entire --target production --apply --backup-manifest <path>
 */
import { createHash } from 'node:crypto';

import { InvitationEditorSectionKeySchema } from '../../src/lib/intake/schemas/invitation-editor.schema.ts';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { auditDraftContract } from '../../src/lib/intake/services/draft-contract-audit.service.ts';
import {
	planDraftRestore,
	type DraftRestoreScope,
} from '../../src/lib/intake/services/draft-restore.service.ts';
import { getProdDbUrl, runPsql, sqlLiteral } from '../db/db-workflow-lib.ts';
import { requireOwnerProductionApply } from '../db/owner-production-apply.ts';
import {
	readDraftCanonicalizationState,
	resolveTargetDbUrl,
} from './draft-canonicalization-service.ts';
import { canonicalize } from './normalized-invitation-release.ts';
import { evaluatePromotionBackupGate } from './invitation-promote.ts';

const args = process.argv.slice(2);
const json = args.includes('--json');
const apply = args.includes('--apply');
const entire = args.includes('--entire');

function value(flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function requireSlug(): string {
	const slug = value('--slug');
	if (!slug || slug.startsWith('--')) throw new Error('SLUG_REQUIRED: pass --slug <invitation-slug>.');
	return slug;
}

function requireTarget(): 'local' | 'preview' | 'production' {
	const target = value('--target') ?? 'local';
	if (target !== 'local' && target !== 'preview' && target !== 'production') {
		throw new Error('TARGET_INVALID: --target must be local, preview or production.');
	}
	return target;
}

function requireScope(): DraftRestoreScope {
	if (entire) return { kind: 'entire' };
	const section = value('--section');
	if (!section) {
		throw new Error('SCOPE_REQUIRED: pass --section <editor-section-key> or --entire.');
	}
	const parsed = InvitationEditorSectionKeySchema.safeParse(section);
	if (!parsed.success) {
		throw new Error(
			`SECTION_INVALID: expected one of ${InvitationEditorSectionKeySchema.options.join(', ')}.`,
		);
	}
	return { kind: 'section', section: parsed.data };
}

function hash(value: unknown): string {
	return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function sqlJson(value: unknown): string {
	return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function loadPlan() {
	const slug = requireSlug();
	const target = requireTarget();
	const scope = requireScope();
	const dbUrl = resolveTargetDbUrl(target);
	const state = readDraftCanonicalizationState(slug, dbUrl);
	if (!state?.published.content) {
		throw new Error(`PUBLISHED_NOT_FOUND: no published revision for ${slug} in ${target}.`);
	}
	const plan = planDraftRestore({
		draftContent: state.draft.content,
		publishedContent: state.published.content,
		scope,
	});
	const audit = auditDraftContract(state.draft.content ?? undefined);
	return {
		slug,
		target,
		dbUrl,
		state,
		plan,
		audit,
		fingerprints: {
			before: hash(state.draft.content ?? {}),
			after: hash(plan.afterContent),
			published: hash(state.published.content),
		},
	};
}

function printPlan(result: ReturnType<typeof loadPlan>): void {
	const { plan, audit, slug, target, state, fingerprints } = result;
	const payload = {
		mode: 'dry-run' as const,
		writes: 0,
		slug,
		target,
		scope: plan.scope,
		draftUpdatedAt: state.draft.updatedAt,
		publishedVersion: state.published.version,
		sectionUnchanged: plan.sectionUnchanged,
		discardedPaths: plan.discardedPaths,
		hashes: fingerprints,
		draftContract: { canonical: audit.canonical, violations: audit.violations },
	};
	if (json) {
		console.log(JSON.stringify(payload, null, 2));
		return;
	}
	console.log(`Draft restore — read-only dry-run (${target}/${slug})`);
	console.log(
		`Scope: ${plan.scope.kind === 'entire' ? 'entire draft' : `section ${plan.scope.section}`}`,
	);
	console.log(`Draft revision: ${state.draft.updatedAt ?? 'none'}`);
	console.log(`Published version: ${state.published.version}`);
	console.log(`Unchanged: ${plan.sectionUnchanged}`);
	console.log(
		`Pending semantic changes discarded (${plan.discardedPaths.length}): ${plan.discardedPaths.join(', ') || 'none'}`,
	);
	console.log(
		`Current draft canonical: ${audit.canonical}; violations: ${audit.violations.length}`,
	);
	console.log('Published content will not be written.');
}

function applyRestoreSql(input: {
	slug: string;
	before: Record<string, unknown>;
	after: Record<string, unknown>;
	published: Record<string, unknown>;
	dbUrl: string;
}): void {
	const sql = `BEGIN;
DO $draft_restore$
DECLARE
  v_invitation_id uuid;
  v_draft public.invitation_content_drafts%rowtype;
  v_published jsonb;
BEGIN
  SELECT i.id INTO v_invitation_id
    FROM public.invitations i
   WHERE i.slug = ${sqlLiteral(input.slug)} AND i.archived_at IS NULL
   ORDER BY i.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_RESTORE_TARGET_NOT_FOUND'; END IF;

  SELECT d.* INTO v_draft
    FROM public.invitation_content_drafts d
   WHERE d.invitation_project_id = v_invitation_id AND d.deleted_at IS NULL
   ORDER BY d.updated_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_RESTORE_DRAFT_NOT_FOUND'; END IF;

  SELECT p.content INTO v_published
    FROM public.published_invitation_content p
   WHERE p.invitation_project_id = v_invitation_id AND p.deleted_at IS NULL
   ORDER BY p.version DESC LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_RESTORE_PUBLISHED_NOT_FOUND'; END IF;

  IF v_published IS DISTINCT FROM ${sqlJson(input.published)} THEN
    RAISE EXCEPTION 'DRAFT_RESTORE_PUBLISHED_CHANGED';
  END IF;
  IF v_draft.content IS DISTINCT FROM ${sqlJson(input.before)} THEN
    RAISE EXCEPTION 'DRAFT_RESTORE_STALE_DRAFT';
  END IF;

  UPDATE public.invitation_content_drafts
     SET content = ${sqlJson(input.after)}
   WHERE id = v_draft.id;
END;
$draft_restore$;
COMMIT;`;
	runPsql(sql, input.dbUrl, { tuplesOnly: true });
}

async function applyPlan(): Promise<void> {
	const result = loadPlan();
	const { plan, slug, target, dbUrl, state, fingerprints } = result;
	if (plan.sectionUnchanged) {
		printPlan(result);
		console.log('Nothing to restore.');
		return;
	}
	if (!state.draft.content || !state.published.content) {
		throw new Error('DRAFT_RESTORE_STATE_UNAVAILABLE: draft and published content are required.');
	}

	if (target === 'production') {
		const backupManifestPath = value('--backup-manifest');
		if (!backupManifestPath) {
			throw new Error(
				'BACKUP_REQUIRED: pass --backup-manifest from a fresh pnpm db:prod:backup:critical run.',
			);
		}
		// Ensure Production URL identity matches the owner-gate expectation.
		getProdDbUrl();
		const backup = evaluatePromotionBackupGate({
			manifestPath: backupManifestPath,
			productionProjectRef: SUPABASE_PROJECT_REFS.production,
			required: true,
		});
		if (!backup.acceptable) throw new Error(backup.detail);
		await requireOwnerProductionApply({
			apply: true,
			dbUrl,
			operationType: 'draft_restore',
			operationVerb: 'RESTORE',
			bindingHex: fingerprints.after,
			applyActionLabel: 'Aplicar',
			summaryTitle: 'Restauración de borrador — Production',
			summary: [
				[
					'Operación',
					plan.scope.kind === 'entire'
						? 'Restaurar borrador completo'
						: `Restaurar sección ${plan.scope.section}`,
				],
				['Invitación', slug],
				['Cambios descartados', String(plan.discardedPaths.length)],
				['Publicación', 'No se modifica'],
			],
			technicalReview: [
				['Algoritmo', 'planDraftRestore (dominio compartido)'],
				['Draft after', fingerprints.after],
				['Controles', 'TTY · agente bloqueado · backup · transacción'],
			],
		});
	}

	applyRestoreSql({
		slug,
		before: state.draft.content,
		after: plan.afterContent as Record<string, unknown>,
		published: state.published.content,
		dbUrl,
	});

	const summary = {
		status: 'applied',
		slug,
		target,
		scope: plan.scope,
		discardedPaths: plan.discardedPaths,
		draftAfter: fingerprints.after,
	};
	if (json) console.log(JSON.stringify(summary, null, 2));
	else console.log(`Draft restore applied for ${slug} (${target}).`);
}

void (async () => {
	try {
		if (apply) await applyPlan();
		else printPlan(loadPlan());
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
})();
