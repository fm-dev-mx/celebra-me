/**
 * Read-only operations snapshot for the terminal; `pnpm ops:status` (scripts/ops/ops-status.ts)
 * prints its sections from the VS Code task «Estado (ops:status)».
 *
 *   tsx scripts/ops/ops-console-snapshot.ts --section git --json
 *   tsx scripts/ops/ops-console-snapshot.ts --section preflight --json
 *   tsx scripts/ops/ops-console-snapshot.ts --section worktrees --json
 *   tsx scripts/ops/ops-console-snapshot.ts --section dbs --json
 *   tsx scripts/ops/ops-console-snapshot.ts --section migrations --remote --json
 *
 * `worktrees` runs `checkSweep` (scripts/agent/worktree-doctor.ts): merged worktrees and branches,
 * stale git-safety baselines and non-lane folders, each with the cleanup command.
 * `dbs` and `migrations` read `pnpm dbs --json`, the read-only status CLI: `dbs` covers Local
 * (schema and publication drift), `migrations` covers Preview and Production and needs
 * `--remote`. Neither writes to a database; their commands are read-only plans or the canonical
 * guarded workflow the owner runs.
 * `git` reads local refs plus `git ls-remote --tags origin`; it never fetches or writes refs.
 * `preflight` diagnoses what `pnpm prod:apply --apply` would stop on in the checkout it runs in
 * (process.cwd()): release-check evidence, CI on HEAD, backup age and the Production variables.
 * It reports presence only, never secret values, and never runs release-check or a backup.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { evaluateCriticalBackupHealth } from '../db/critical-backup-health.ts';
import { CRITICAL_BACKUP_RPO_MS } from '../db/critical-backup-reuse.ts';
import {
	extractSupabaseProjectRef,
	getSecretFromEnvOrFiles,
	PROD_SECRET_FILES,
} from '../db/db-target-config.ts';
import {
	currentReleaseCheckEnvironment,
	matchesEnvironment,
	readReleaseCheckEvidence,
	type ReleaseCheckEnvironment,
	type ReleaseCheckEvidence,
} from '../db/release-check.ts';
import { loadRemoteChecks, requireReleaseChecks } from './release-readiness.ts';
import { checkSweep, type SweepFinding } from '../agent/worktree-doctor.ts';
import { findRepoRoot } from '../shared/worktree-lane.ts';

export type OpsStatus = 'ok' | 'warn' | 'block' | 'unknown';

export interface OpsItem {
	id: string;
	label: string;
	status: OpsStatus;
	detail: string;
	/** Command the owner runs in their own terminal to resolve it. Never run by the console. */
	fix?: string;
}

export interface OpsCommit {
	sha: string;
	date: string;
	ageHours: number;
	subject: string;
}

export interface GitSection {
	section: 'git';
	generatedAt: string;
	originFetchedAt: string | null;
	tagSource: 'origin' | 'local';
	latestTag: { name: string; sha: string; date: string } | null;
	untaggedMainCommits: OpsCommit[];
	developAhead: number;
	developBehind: number;
	developAheadCommits: OpsCommit[];
	items: OpsItem[];
}

export interface PreflightSection {
	section: 'preflight';
	generatedAt: string;
	checkout: string;
	branch: string;
	headSha: string | null;
	verdict: OpsStatus;
	items: OpsItem[];
}

export interface WorktreesSection {
	section: 'worktrees';
	generatedAt: string;
	repoRoot: string;
	items: OpsItem[];
}

export interface DbsSection {
	section: 'dbs';
	generatedAt: string;
	items: OpsItem[];
}

export interface MigrationsSection {
	section: 'migrations';
	generatedAt: string;
	items: OpsItem[];
}

export type OpsSnapshotSection =
	GitSection | PreflightSection | WorktreesSection | DbsSection | MigrationsSection;

type Git = (args: string[]) => string;

const defaultGit: Git = (args) =>
	execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const HOUR_MS = 60 * 60 * 1000;
const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+/;
const MAIN_WALK_LIMIT = 60;

function ageHours(date: string, nowMs: number): number {
	return Math.max(0, Math.round(((nowMs - Date.parse(date)) / HOUR_MS) * 10) / 10);
}

function formatHours(hours: number): string {
	if (hours < 1) return `${Math.round(hours * 60)} min`;
	if (hours < 48) return `${Math.round(hours)} h`;
	return `${Math.round(hours / 24)} días`;
}

function parseCommitLines(raw: string, nowMs: number): OpsCommit[] {
	return raw
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			const [sha = '', date = '', ...subject] = line.split('\t');
			return { sha, date, ageHours: ageHours(date, nowMs), subject: subject.join('\t') };
		});
}

/** `git ls-remote --tags` lines → commit SHA → tag names (annotated tags use the peeled `^{}` line). */
export function parseRemoteTags(raw: string): Map<string, string[]> {
	const direct = new Map<string, string>();
	const peeled = new Map<string, string>();
	for (const line of raw.split(/\r?\n/)) {
		const [sha, ref] = line.trim().split(/\s+/);
		if (!sha || !ref?.startsWith('refs/tags/')) continue;
		const name = ref.slice('refs/tags/'.length);
		if (name.endsWith('^{}')) peeled.set(name.slice(0, -3), sha);
		else direct.set(name, sha);
	}
	const byCommit = new Map<string, string[]>();
	for (const [name, sha] of direct) {
		if (!RELEASE_TAG_PATTERN.test(name)) continue;
		const commit = peeled.get(name) ?? sha;
		byCommit.set(commit, [...(byCommit.get(commit) ?? []), name]);
	}
	return byCommit;
}

/**
 * Main's first-parent history from the tip down to the newest release-tagged commit. Everything
 * above that commit was merged without a tag; `latest` is the tagged commit itself.
 */
export function splitUntagged(
	mainCommits: readonly OpsCommit[],
	tagsByCommit: ReadonlyMap<string, readonly string[]>,
): { untagged: OpsCommit[]; latest: { name: string; sha: string; date: string } | null } {
	const untagged: OpsCommit[] = [];
	for (const commit of mainCommits) {
		const tags = tagsByCommit.get(commit.sha);
		if (tags?.length) {
			return {
				untagged,
				latest: { name: [...tags].sort().at(-1)!, sha: commit.sha, date: commit.date },
			};
		}
		untagged.push(commit);
	}
	return { untagged, latest: null };
}

function readOriginFetchedAt(git: Git): string | null {
	try {
		const path = resolve(git(['rev-parse', '--git-path', 'FETCH_HEAD']));
		return existsSync(path) ? statSync(path).mtime.toISOString() : null;
	} catch {
		return null;
	}
}

export function collectGitSection(git: Git = defaultGit, nowMs = Date.now()): GitSection {
	const log = (range: string, limit: number): OpsCommit[] =>
		parseCommitLines(
			git([
				'log',
				'--first-parent',
				`--max-count=${limit}`,
				'--format=%H%x09%cI%x09%s',
				range,
			]),
			nowMs,
		);
	const main = log('origin/main', MAIN_WALK_LIMIT);

	let tagSource: GitSection['tagSource'] = 'origin';
	let tagsByCommit: Map<string, string[]>;
	try {
		tagsByCommit = parseRemoteTags(git(['ls-remote', '--tags', 'origin']));
	} catch {
		// Offline: local tags may lag behind origin, so the section says which source it used.
		tagSource = 'local';
		tagsByCommit = parseRemoteTags(
			git([
				'for-each-ref',
				'--format=%(objectname) refs/tags/%(refname:short)%0a%(*objectname) refs/tags/%(refname:short)^{}',
				'refs/tags',
			]),
		);
	}
	const { untagged, latest } = splitUntagged(main, tagsByCommit);

	const [behindRaw = '0', aheadRaw = '0'] = git([
		'rev-list',
		'--left-right',
		'--count',
		'origin/main...origin/develop',
	]).split(/\s+/);
	const developAhead = Number(aheadRaw);
	const developBehind = Number(behindRaw);
	const developAheadCommits = developAhead > 0 ? log('origin/main..origin/develop', 15) : [];
	const originFetchedAt = readOriginFetchedAt(git);

	const items: OpsItem[] = [];
	const oldest = untagged.at(-1);
	items.push(
		untagged.length === 0
			? {
					id: 'main-tags',
					label: 'Tags de main',
					status: 'ok',
					detail: latest
						? `La última unión a main tiene su tag (${latest.name}).`
						: 'No hay uniones recientes en main.',
				}
			: {
					id: 'main-tags',
					label: 'Tags de main',
					status: oldest && oldest.ageHours >= 2 ? 'block' : 'warn',
					detail: `${untagged.length} unión(es) a main sin tag; la más antigua lleva ${formatHours(oldest?.ageHours ?? 0)}. La sesión del release crea y sube el tag cuando release-status diga VERIFIED.`,
					fix: 'pnpm release-status --target production --sha <sha>',
				},
	);
	items.push({
		id: 'develop-vs-main',
		label: 'develop frente a main',
		status: developAhead > 0 ? 'warn' : 'ok',
		detail:
			developAhead > 0
				? `develop lleva ${developAhead} commit(s) que aún no están en main (main tiene ${developBehind} que develop no tiene).`
				: 'develop no tiene commits pendientes de llevar a main.',
	});
	const fetchedHours = originFetchedAt ? ageHours(originFetchedAt, nowMs) : null;
	if (fetchedHours === null || fetchedHours > 6) {
		items.push({
			id: 'origin-freshness',
			label: 'Datos de origin',
			status: 'warn',
			detail:
				fetchedHours === null
					? 'No se sabe cuándo se actualizaron las ramas de origin en este checkout.'
					: `Las ramas de origin se actualizaron hace ${formatHours(fetchedHours)}; la consola no hace fetch.`,
			fix: 'git fetch origin',
		});
	}

	return {
		section: 'git',
		generatedAt: new Date(nowMs).toISOString(),
		originFetchedAt,
		tagSource,
		latestTag: latest,
		untaggedMainCommits: untagged,
		developAhead,
		developBehind,
		developAheadCommits,
		items,
	};
}

/** Read-only twin of `ensureValidReleaseCheckEvidence`: classifies, never clears or reruns. */
export function classifyReleaseCheckEvidence(input: {
	headSha: string | null;
	clean: boolean;
	evidence: ReleaseCheckEvidence | null;
	environment: ReleaseCheckEnvironment;
	nowMs: number;
}): OpsItem {
	const base = {
		id: 'release-check',
		label: 'Evidencia de release-check',
		fix: 'pnpm release-check',
	};
	if (!input.clean) {
		return {
			...base,
			status: 'block',
			detail: 'El checkout tiene cambios sin commit; release-check y prod:apply exigen un árbol limpio.',
			fix: 'git status',
		};
	}
	if (!input.evidence) {
		return {
			...base,
			status: 'warn',
			detail: 'No hay evidencia: prod:apply correrá release-check completo (pruebas y build) antes del respaldo.',
		};
	}
	if (input.evidence.sha !== input.headSha) {
		return {
			...base,
			status: 'warn',
			detail: `La evidencia es de ${input.evidence.sha.slice(0, 9)}, no del HEAD actual; prod:apply la descartará y volverá a correr release-check.`,
		};
	}
	if (!matchesEnvironment(input.evidence, input.environment)) {
		return {
			...base,
			status: 'warn',
			detail: 'La evidencia se hizo con otro lockfile o con otra versión de Node.js; prod:apply la descartará.',
		};
	}
	return {
		...base,
		status: 'ok',
		detail: `Vigente para el HEAD actual (hace ${formatHours(ageHours(input.evidence.createdAt, input.nowMs))}).`,
		fix: undefined,
	};
}

export function classifyBackupAge(input: {
	newestAgeMs: number | null;
	dailyAttention: boolean;
	summary: string;
	checkoutLabel?: string;
}): OpsItem {
	const base = { id: 'backup', label: 'Respaldo crítico de Production' };
	const where = input.checkoutLabel ? ` (almacén de ${input.checkoutLabel})` : '';
	if (input.newestAgeMs !== null && input.newestAgeMs <= CRITICAL_BACKUP_RPO_MS) {
		return {
			...base,
			status: 'ok',
			detail: `Hay un respaldo de hace ${Math.round(input.newestAgeMs / 60_000)} min${where}; prod:apply puede reutilizarlo si lo corre dentro de 15 min.`,
		};
	}
	return {
		...base,
		status: input.dailyAttention ? 'warn' : 'ok',
		detail: `${input.summary}${where}. El respaldo vence a los 15 min, así que prod:apply tomará uno nuevo justo antes de pedirle la confirmación: no lo deje esperando o verá BACKUP_COVERAGE_EXPIRED.`,
	};
}

const PRODUCTION_VARIABLES = [
	'PROD_DB_URL',
	'PROD_SUPABASE_URL',
	'PROD_SUPABASE_SERVICE_ROLE_KEY',
] as const;

export function classifyProductionVariables(read: (name: string) => string): OpsItem[] {
	const missing = PRODUCTION_VARIABLES.filter((name) => !read(name));
	const items: OpsItem[] = [
		{
			id: 'production-variables',
			label: 'Variables de Production',
			status: missing.length ? 'block' : 'ok',
			detail: missing.length
				? `Faltan: ${missing.join(', ')}. Se leen del entorno o de ${PROD_SECRET_FILES.join(', ')}.`
				: `Presentes: ${PRODUCTION_VARIABLES.join(', ')} (no se muestran sus valores).`,
		},
	];
	const dbUrl = read('PROD_DB_URL');
	if (dbUrl) {
		let projectRef: string | null;
		try {
			projectRef = extractSupabaseProjectRef(dbUrl);
		} catch {
			projectRef = null;
		}
		items.push({
			id: 'production-project',
			label: 'Proyecto de PROD_DB_URL',
			status: projectRef === SUPABASE_PROJECT_REFS.production ? 'ok' : 'block',
			detail:
				projectRef === SUPABASE_PROJECT_REFS.production
					? 'Apunta al proyecto de Production.'
					: 'No apunta al proyecto de Production; prod:apply se detendrá antes del respaldo.',
		});
	}
	return items;
}

function classifyTaskScope(value: string | undefined): OpsItem {
	return {
		id: 'task-scope',
		label: 'CELEBRA_TASK_SCOPE',
		status: value ? 'block' : 'ok',
		detail: value
			? 'Está definida en el proceso de la consola; si también está en su terminal, prod:apply responderá CONFIRMATION_REQUIRED.'
			: 'No está definida aquí. Corra prod:apply en una terminal nueva donde tampoco esté definida.',
	};
}

function classifyRemoteChecks(headSha: string | null): OpsItem {
	const base = { id: 'remote-ci', label: 'CI del HEAD en GitHub' };
	if (!headSha) return { ...base, status: 'unknown', detail: 'No se pudo leer el HEAD.' };
	try {
		requireReleaseChecks(headSha, loadRemoteChecks(headSha));
		return {
			...base,
			status: 'ok',
			detail: `Checks de release verdes para ${headSha.slice(0, 9)}.`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const pending = /pending/i.test(message);
		return {
			...base,
			status: pending ? 'warn' : 'block',
			detail: pending
				? `CI sigue corriendo para ${headSha.slice(0, 9)}; espere a que termine antes de prod:apply.`
				: `CI no está verde o no se pudo leer: ${message}`,
		};
	}
}

const STATUS_RANK: Record<OpsStatus, number> = { ok: 0, unknown: 1, warn: 2, block: 3 };

export function worstStatus(items: readonly OpsItem[]): OpsStatus {
	return items.reduce<OpsStatus>(
		(worst, item) => (STATUS_RANK[item.status] > STATUS_RANK[worst] ? item.status : worst),
		'ok',
	);
}

function collectPreflightSection(git: Git = defaultGit, nowMs = Date.now()): PreflightSection {
	const items: OpsItem[] = [];
	let headSha: string | null = null;
	let branch = 'desconocida';
	let clean = false;
	try {
		headSha = git(['rev-parse', 'HEAD']);
		branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
		clean = git(['status', '--porcelain']) === '';
	} catch {
		// Leaves headSha null; the items below report it as unknown.
	}

	let originMain: string | null;
	try {
		originMain = git(['rev-parse', 'origin/main']);
	} catch {
		originMain = null;
	}
	items.push({
		id: 'checkout',
		label: 'Checkout',
		status: branch === 'main' && headSha === originMain ? 'ok' : 'warn',
		detail:
			branch === 'main' && headSha === originMain
				? 'En main, igual a origin/main.'
				: `Rama ${branch}${headSha ? ` en ${headSha.slice(0, 9)}` : ''}; prod:apply se corre en main igual a origin/main.`,
		fix: branch === 'main' ? 'git pull --ff-only' : undefined,
	});
	items.push(
		classifyReleaseCheckEvidence({
			headSha,
			clean,
			evidence: readReleaseCheckEvidence(),
			environment: currentReleaseCheckEnvironment(),
			nowMs,
		}),
	);
	items.push(classifyRemoteChecks(headSha));
	const health = evaluateCriticalBackupHealth({ nowMs });
	items.push(
		classifyBackupAge({
			newestAgeMs: health.newestAgeMs,
			dailyAttention: health.attention,
			summary: health.summary,
			checkoutLabel: health.checkoutLabel,
		}),
	);
	items.push(
		...classifyProductionVariables((name) => getSecretFromEnvOrFiles(name, PROD_SECRET_FILES)),
	);
	items.push(classifyTaskScope(process.env.CELEBRA_TASK_SCOPE));

	return {
		section: 'preflight',
		generatedAt: new Date(nowMs).toISOString(),
		checkout: basename(process.cwd()),
		branch,
		headSha,
		verdict: worstStatus(items),
		items,
	};
}

const SWEEP_LABEL: Record<SweepFinding['kind'], string> = {
	worktree: 'Worktree unido',
	branch: 'Rama unida',
	baseline: 'Baseline viejo de git-safety',
	folder: 'Carpeta fuera de carril',
};

export function sweepToItems(sweep: readonly SweepFinding[]): OpsItem[] {
	if (sweep.length === 0) {
		return [
			{
				id: 'sweep',
				label: 'Limpieza',
				status: 'ok',
				detail: 'No hay worktrees, ramas, baselines ni carpetas por barrer.',
			},
		];
	}
	return sweep.map((finding) => ({
		id: `sweep-${finding.kind}:${finding.subject}`,
		label: SWEEP_LABEL[finding.kind],
		// Without gh an open PR cannot be ruled out, so the owner checks before running the command.
		status: finding.prChecked ? 'warn' : 'unknown',
		detail: finding.detail,
		fix: finding.command,
	}));
}

function collectWorktreesSection(nowMs = Date.now()): WorktreesSection {
	const repoRoot = findRepoRoot(process.cwd());
	return {
		section: 'worktrees',
		generatedAt: new Date(nowMs).toISOString(),
		repoRoot: repoRoot.replaceAll('\\', '/'),
		items: sweepToItems(checkSweep(repoRoot)),
	};
}

/** The fields of `pnpm dbs --json` (src/lib/status/dbs-json.ts) these sections read. */
export interface DbsEnvironmentSummary {
	environment: string;
	schemaLifecycle: string;
	migrationHead: string | null;
	pendingMigrations: string[];
	extraMigrations: string[];
	identityConflictsCount: number;
	schemaNextAction: string | null;
	evidence: string;
}

export interface DbsSnapshot {
	environments: Partial<Record<DbsTarget, DbsEnvironmentSummary | null>>;
	operationalPlan: {
		actions: Array<{
			id: string;
			title: string;
			why?: string;
			summary?: string;
			steps: Array<{ command?: string | null; optional?: boolean }>;
		}>;
	};
}

export type DbsTarget = 'local' | 'preview' | 'production';
export type DbsReader = (targets: readonly DbsTarget[]) => DbsSnapshot;

const DBS_TARGET_LABEL: Record<DbsTarget, string> = {
	local: 'Local',
	preview: 'Preview',
	production: 'Production',
};
/** Read-only plans: each prints what is pending and how to apply it, without writing. */
const MIGRATION_REVIEW_COMMAND: Record<DbsTarget, string> = {
	local: 'pnpm db:migrate -- --target local',
	preview: 'pnpm db:migrate -- --target preview',
	production: 'pnpm prod:apply -- --schema',
};
const DBS_ACTION_LIMIT = 12;

/** `pnpm dbs` is the read-only status CLI; it never writes to any database. */
const defaultDbsReader: DbsReader = (targets) => {
	const stdout = execFileSync(
		process.execPath,
		[
			'--import',
			'tsx',
			resolve(process.cwd(), 'scripts/provision/dbs-cli.ts'),
			'--targets',
			targets.join(','),
			'--json',
		],
		{
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			timeout: 120_000,
			maxBuffer: 64 * 1024 * 1024,
			windowsHide: true,
		},
	);
	const start = stdout.indexOf('{');
	if (start === -1) throw new Error('pnpm dbs no devolvió JSON.');
	return JSON.parse(stdout.slice(start)) as DbsSnapshot;
};

/** Last stderr line of a failed child (its own message), else the error's first line. */
function failureLine(error: unknown): string {
	const stderr = (error as { stderr?: unknown } | null)?.stderr;
	const lines = (typeof stderr === 'string' ? stderr : '').split(/\r?\n/).filter((l) => l.trim());
	const message = error instanceof Error ? error.message : String(error);
	return (
		(lines.at(-1) ?? message.split(/\r?\n/)[0] ?? '').trim().slice(0, 200) ||
		'error desconocido'
	);
}

export function classifySchema(
	target: DbsTarget,
	env: DbsEnvironmentSummary | null | undefined,
): OpsItem {
	const base = {
		id: `schema-${target}`,
		label: `Migraciones en ${DBS_TARGET_LABEL[target]}`,
	};
	if (!env || env.evidence === 'UNAVAILABLE') {
		return {
			...base,
			status: 'unknown',
			detail: 'Sin comprobar: dbs no pudo leer este entorno.',
			fix: `pnpm dbs --targets ${target}`,
		};
	}
	if (env.extraMigrations.length > 0) {
		return {
			...base,
			status: 'block',
			detail: `La base tiene ${env.extraMigrations.length} migración(es) que el repositorio no conoce: ${env.extraMigrations.join(', ')}.`,
			fix: `pnpm dbs --targets ${target} --verbose`,
		};
	}
	if (env.pendingMigrations.length > 0) {
		return {
			...base,
			status: 'warn',
			detail: `${env.pendingMigrations.length} pendiente(s): ${env.pendingMigrations.join(', ')}.`,
			fix: env.schemaNextAction ?? MIGRATION_REVIEW_COMMAND[target],
		};
	}
	return {
		...base,
		status: 'ok',
		detail: `Al día${env.migrationHead ? ` (última: ${env.migrationHead})` : ''}.`,
	};
}

export function dbsLocalItems(snapshot: DbsSnapshot): OpsItem[] {
	const local = snapshot.environments.local;
	const items = [classifySchema('local', local)];
	if (local && local.identityConflictsCount > 0) {
		items.push({
			id: 'identity-local',
			label: 'Identidad de invitaciones en Local',
			status: 'warn',
			detail: `${local.identityConflictsCount} conflicto(s) de identidad.`,
			fix: 'pnpm dbs --targets local --verbose',
		});
	}
	const actions = snapshot.operationalPlan.actions;
	for (const action of actions.slice(0, DBS_ACTION_LIMIT)) {
		const step = action.steps.find((candidate) => candidate.command && !candidate.optional);
		items.push({
			id: `dbs-${action.id}`,
			label: action.title,
			status: 'warn',
			detail: action.why ?? action.summary ?? 'Requiere atención.',
			fix: step?.command ?? undefined,
		});
	}
	if (actions.length > DBS_ACTION_LIMIT) {
		items.push({
			id: 'dbs-more',
			label: 'Más acciones de dbs',
			status: 'warn',
			detail: `${actions.length - DBS_ACTION_LIMIT} acción(es) más.`,
			fix: 'pnpm dbs --targets local',
		});
	}
	if (items.length === 1 && items[0]!.status === 'ok') {
		items.push({
			id: 'dbs-in-sync',
			label: 'Invitaciones en Local',
			status: 'ok',
			detail: 'Local coincide con el canónico.',
		});
	}
	return items;
}

export function collectDbsSection(
	read: DbsReader = defaultDbsReader,
	nowMs = Date.now(),
): DbsSection {
	let items: OpsItem[];
	try {
		items = dbsLocalItems(read(['local']));
	} catch (error) {
		items = [
			{
				id: 'dbs-local',
				label: 'dbs en Local',
				status: 'unknown',
				detail: `Sin comprobar: ${failureLine(error)}. ¿Está corriendo Supabase local?`,
				fix: 'pnpm dbs --targets local',
			},
		];
	}
	return { section: 'dbs', generatedAt: new Date(nowMs).toISOString(), items };
}

const REMOTE_TARGETS = ['preview', 'production'] as const satisfies readonly DbsTarget[];

export function collectMigrationsSection(
	read: DbsReader = defaultDbsReader,
	nowMs = Date.now(),
): MigrationsSection {
	let snapshot: DbsSnapshot | null = null;
	let failure = '';
	try {
		snapshot = read(REMOTE_TARGETS);
	} catch (error) {
		failure = failureLine(error);
	}
	const items = REMOTE_TARGETS.map((target) => {
		const item = classifySchema(target, snapshot?.environments[target]);
		return snapshot ? item : { ...item, detail: `Sin comprobar: ${failure}.` };
	});
	return { section: 'migrations', generatedAt: new Date(nowMs).toISOString(), items };
}

const SECTIONS = ['git', 'preflight', 'worktrees', 'dbs', 'migrations'] as const;
type SectionName = (typeof SECTIONS)[number];

function collectSection(section: SectionName): OpsSnapshotSection {
	switch (section) {
		case 'git':
			return collectGitSection();
		case 'preflight':
			return collectPreflightSection();
		case 'worktrees':
			return collectWorktreesSection();
		case 'dbs':
			return collectDbsSection();
		case 'migrations':
			return collectMigrationsSection();
	}
}

function main(argv: string[]): void {
	const sectionIndex = argv.indexOf('--section');
	const section = sectionIndex === -1 ? undefined : argv[sectionIndex + 1];
	if (!SECTIONS.includes(section as SectionName)) {
		process.stderr.write(
			`Uso: ops-console-snapshot --section ${SECTIONS.join('|')} [--remote] [--json]\n`,
		);
		process.exitCode = 2;
		return;
	}
	if (section === 'migrations' && !argv.includes('--remote')) {
		process.stderr.write('La sección migrations lee Preview y Production: agregue --remote.\n');
		process.exitCode = 2;
		return;
	}
	const result = collectSection(section as SectionName);
	if (argv.includes('--json')) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
		return;
	}
	for (const item of result.items) {
		process.stdout.write(
			`[${item.status}] ${item.label}: ${item.detail}${item.fix ? `\n    → ${item.fix}` : ''}\n`,
		);
	}
}

if (/ops-console-snapshot\.(ts|js|mjs)$/.test(process.argv[1] ?? '')) {
	main(process.argv.slice(2));
}
