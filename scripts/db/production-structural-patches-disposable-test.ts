/**
 * Runtime contract for the two P0 structural Production patches.
 *
 * This executes the versioned SQL against PostgreSQL 17 disposable data only.
 * The tests prove the transaction guards, target population, idempotence, and
 * rollback behavior without opening a Production connection.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { DISPOSABLE_DB_URL, classifyDbTarget, redactCredentials } from './db-target-config.ts';
import { runPsql, runPsqlFile, type CommandResult } from './db-workflow-lib.ts';

interface PatchCase {
	name: string;
	file: string;
	rows: Array<{ slug: string; eventType: string }>;
	failureCode: string;
	conflictContent: string;
	canonicalPredicate: string;
	initialVersion?: number;
	galleryCanonicalCount?: number;
}

const PATCHES: PatchCase[] = [
	{
		name: 'abril residual itinerary structural contract',
		file: '20260814_p0_abril_itinerary_residual_structural_contracts.sql',
		rows: [{ slug: 'abril-michelle-becerra-rea', eventType: 'xv' }],
		failureCode: 'P0_RESIDUAL_CONTRACT_ABORT',
		conflictContent: `jsonb_build_object('itinerary', jsonb_build_object('variant', 'standard'))`,
		canonicalPredicate: `content#>>'{itinerary,variant}' = 'timeline-paper' and content#>>'{itinerary,presentation,behavior}' = 'timeline-paper'`,
		initialVersion: 12,
	},
	{
		name: 'itinerary and gallery structural contracts',
		file: '20260812_p0_itinerary_gallery_structural_contracts.sql',
		rows: [
			{ slug: 'xareni-iyarit', eventType: 'xv' },
			{ slug: 'america-johana', eventType: 'xv' },
			{ slug: 'ana-sofia-cota-guillen', eventType: 'xv' },
			{ slug: 'abril-michelle-becerra-rea', eventType: 'xv' },
		],
		failureCode: 'P0_CONTRACT_ABORT',
		conflictContent: `jsonb_build_object('itinerary', jsonb_build_object('variant', 'standard'))`,
		canonicalPredicate: `content#>>'{itinerary,variant}' = 'timeline-paper' and content#>>'{itinerary,presentation,behavior}' = 'timeline-paper'`,
		galleryCanonicalCount: 3,
	},
	{
		name: 'thank-you editorial back-cover contracts',
		file: '20260812_thankyou_editorial_back_cover_structural_contracts.sql',
		rows: [
			{ slug: 'xareni-iyarit', eventType: 'xv' },
			{ slug: 'america-johana', eventType: 'xv' },
			{ slug: 'ana-sofia-cota-guillen', eventType: 'xv' },
			{ slug: 'ayrin-samantha-lerma-castro', eventType: 'xv' },
			{ slug: 'leah-lexa', eventType: 'baby-shower' },
		],
		failureCode: 'THANKYOU_CONTRACT_ABORT',
		conflictContent: `jsonb_build_object('thankYou', jsonb_build_object('variant', 'standard'))`,
		canonicalPredicate: `content#>>'{thankYou,variant}' = 'editorial-back-cover' and content#>>'{sectionStyles,thankYou,structuralVariant}' = 'editorial-back-cover'`,
	},
];

function fail(message: string): never {
	throw new Error(message);
}

function sqlLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function runSql(sql: string, label: string): CommandResult {
	const result = runPsql(sql, DISPOSABLE_DB_URL, { throwOnError: false });
	if (result.status !== 0) {
		fail(`${label} failed: ${redactCredentials(result.stderr || result.stdout || `exit ${result.status}`)}`);
	}
	return result;
}

function query(sql: string, label: string): string {
	return runSql(sql, label).stdout.trim();
}

function assertDisposableTarget(): void {
	const classification = classifyDbTarget(DISPOSABLE_DB_URL);
	if (classification.target !== 'disposable-test') {
		fail(`Structural patch test requires disposable-test, received ${classification.target}.`);
	}
}

function patchPath(patch: PatchCase): string {
	return resolve(process.cwd(), 'scripts/manual/production-patches', patch.file);
}

function recreateFixture(patch: PatchCase): void {
	const invitations = patch.rows
		.map((row, index) => `(${sqlLiteral(`id-${index + 1}`)}, ${sqlLiteral(row.slug)}, ${sqlLiteral(row.eventType)})`)
		.join(',\n');
	runSql(
		`
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE TABLE public.invitations (
  id text PRIMARY KEY,
  slug text NOT NULL,
  event_type text NOT NULL,
  archived_at timestamptz
);
CREATE TABLE public.published_invitation_content (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invitation_project_id text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz,
  deleted_at timestamptz
);
CREATE TABLE public.invitation_content_drafts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invitation_project_id text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz,
  deleted_at timestamptz
);
	INSERT INTO public.invitations (id, slug, event_type) VALUES ${invitations};
INSERT INTO public.published_invitation_content (invitation_project_id, version)
SELECT id, ${patch.initialVersion ?? 1} FROM public.invitations;
INSERT INTO public.invitation_content_drafts (invitation_project_id)
SELECT id FROM public.invitations;
`,
		`recreate ${patch.name} fixture`,
	);
}

function applyPatch(patch: PatchCase): CommandResult {
	return runPsqlFile(patchPath(patch), DISPOSABLE_DB_URL, { throwOnError: false });
}

function requireSuccess(result: CommandResult, label: string): void {
	if (result.status !== 0) {
		fail(`${label} should succeed: ${redactCredentials(result.stderr || result.stdout || `exit ${result.status}`)}`);
	}
}

function requireFailure(result: CommandResult, code: string, label: string): void {
	const output = `${result.stdout}\n${result.stderr}`;
	if (result.status === 0 || !output.includes(code)) {
		fail(`${label} must fail with ${code}: ${redactCredentials(output || `exit ${result.status}`)}`);
	}
}

function canonicalCount(patch: PatchCase, table: string): number {
	return Number(
		query(
			`select count(*)::text from public.${table} where ${patch.canonicalPredicate};`,
			`${patch.name} canonical ${table} count`,
		),
	);
}

function assertCanonicalRows(patch: PatchCase): void {
	for (const table of ['published_invitation_content', 'invitation_content_drafts']) {
		const count = canonicalCount(patch, table);
		if (count !== patch.rows.length) {
			fail(`${patch.name} expected ${patch.rows.length} canonical ${table} rows, got ${count}.`);
		}
	}
	if (patch.galleryCanonicalCount !== undefined) {
		const galleryCount = Number(
			query(
				`select count(*)::text from public.published_invitation_content where content#>>'{gallery,variant}' = 'index-choreography';`,
				'gallery canonical count',
			),
		);
		if (galleryCount !== patch.galleryCanonicalCount) fail(`Itinerary patch expected ${patch.galleryCanonicalCount} canonical gallery rows, got ${galleryCount}.`);
	}
}

function testSuccessfulExecutionAndRerun(patch: PatchCase): void {
	recreateFixture(patch);
	requireSuccess(applyPatch(patch), `${patch.name} first apply`);
	assertCanonicalRows(patch);
	const firstVersions = query(
		`select string_agg(version::text, ',' order by id) from public.published_invitation_content;`,
		`${patch.name} first versions`,
	);
	requireSuccess(applyPatch(patch), `${patch.name} idempotent rerun`);
	assertCanonicalRows(patch);
	const rerunVersions = query(
		`select string_agg(version::text, ',' order by id) from public.published_invitation_content;`,
		`${patch.name} rerun versions`,
	);
	if (firstVersions !== rerunVersions) fail(`${patch.name} rerun changed already-canonical published rows.`);
	console.info(`PASS ${patch.name}: expected rows and idempotent rerun`);
}

function testMissingAndDuplicateRowsFailClosed(patch: PatchCase): void {
	const target = patch.rows[0]!;
	recreateFixture(patch);
	runSql(
		`delete from public.published_invitation_content p using public.invitations i where p.invitation_project_id = i.id and i.slug = ${sqlLiteral(target.slug)};`,
		`${patch.name} remove target`,
	);
	requireFailure(applyPatch(patch), patch.failureCode, `${patch.name} missing row`);
	if (canonicalCount(patch, 'invitation_content_drafts') !== 0) {
		fail(`${patch.name} missing-row failure partially updated drafts.`);
	}

	recreateFixture(patch);
	runSql(
		`insert into public.published_invitation_content (invitation_project_id) select id from public.invitations where slug = ${sqlLiteral(target.slug)};`,
		`${patch.name} duplicate target`,
	);
	requireFailure(applyPatch(patch), patch.failureCode, `${patch.name} duplicate row`);
	if (canonicalCount(patch, 'invitation_content_drafts') !== 0) {
		fail(`${patch.name} duplicate-row failure partially updated drafts.`);
	}
	console.info(`PASS ${patch.name}: missing and duplicate rows fail closed`);
}

function testConflictAndRollback(patch: PatchCase): void {
	const target = patch.rows[0]!;
	recreateFixture(patch);
	runSql(
		`update public.published_invitation_content p set content = ${patch.conflictContent} from public.invitations i where p.invitation_project_id = i.id and i.slug = ${sqlLiteral(target.slug)};`,
		`${patch.name} seed conflict`,
	);
	requireFailure(applyPatch(patch), patch.failureCode, `${patch.name} conflict`);
	if (canonicalCount(patch, 'invitation_content_drafts') !== 0) {
		fail(`${patch.name} conflict failure partially updated drafts.`);
	}

	recreateFixture(patch);
	runSql(
		`
CREATE FUNCTION public.reject_draft_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'TEST_DRAFT_ROLLBACK';
END;
$$;
CREATE TRIGGER reject_draft_update BEFORE UPDATE ON public.invitation_content_drafts
FOR EACH ROW EXECUTE FUNCTION public.reject_draft_update();
`,
		`${patch.name} install rollback trigger`,
	);
	requireFailure(applyPatch(patch), 'TEST_DRAFT_ROLLBACK', `${patch.name} rollback trigger`);
	if (canonicalCount(patch, 'published_invitation_content') !== 0) {
		fail(`${patch.name} draft failure did not roll back published mutations.`);
	}
	console.info(`PASS ${patch.name}: conflicts and post-write rollback`);
}

function main(): void {
	assertDisposableTarget();
	for (const patch of PATCHES) {
		if (!existsSync(patchPath(patch))) fail(`Patch file not found: ${patchPath(patch)}`);
		testSuccessfulExecutionAndRerun(patch);
		testMissingAndDuplicateRowsFailClosed(patch);
		testConflictAndRollback(patch);
	}
	console.info('Production structural patch disposable integration: PASS');
}

main();
