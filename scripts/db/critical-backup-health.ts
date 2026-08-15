/**
 * Local-only critical backup health for operator status (pnpm dbs).
 * Does not contact Supabase, Vercel, or Cloudinary.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_CRITICAL_BACKUP_ROOT } from './critical-backup-reuse.ts';
import { listCriticalBackups } from './local-backup-operations.ts';

export const DAILY_BACKUP_RPO_MS = 24 * 60 * 60 * 1000;

export interface CriticalBackupHealth {
	newestManifestPath: string | null;
	newestCreatedAt: string | null;
	newestAgeMs: number | null;
	lastDailyReportAt: string | null;
	lastDailyOutcome: 'succeeded' | 'failed' | null;
	orphanCount: number;
	attention: boolean;
	summary: string;
}

interface DailyBackupReportFile {
	startedAt?: string;
	endedAt?: string;
	outcome?: 'succeeded' | 'failed';
}

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function manifestCreatedAt(manifestPath: string): string | null {
	const parsed = readJson(manifestPath);
	if (!parsed || typeof parsed !== 'object') return null;
	const createdAt = (parsed as { createdAt?: unknown }).createdAt;
	return typeof createdAt === 'string' && createdAt.trim() ? createdAt : null;
}

function formatAge(ageMs: number): string {
	const hours = Math.floor(ageMs / (60 * 60 * 1000));
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}

function scanCriticalSets(
	backupRoot: string,
	nowMs: number,
): Pick<
	CriticalBackupHealth,
	'newestManifestPath' | 'newestCreatedAt' | 'newestAgeMs' | 'orphanCount'
> {
	let newestManifestPath: string | null = null;
	let newestCreatedAt: string | null = null;
	let newestAgeMs: number | null = null;
	let orphanCount = 0;
	if (!existsSync(backupRoot)) {
		return { newestManifestPath, newestCreatedAt, newestAgeMs, orphanCount };
	}
	for (const candidate of listCriticalBackups(backupRoot)) {
		const manifestPath = join(candidate.path, 'manifest.json');
		if (!existsSync(manifestPath)) {
			orphanCount += 1;
			continue;
		}
		const createdAt = manifestCreatedAt(manifestPath);
		if (!createdAt) continue;
		if (newestCreatedAt != null && Date.parse(createdAt) <= Date.parse(newestCreatedAt)) {
			continue;
		}
		const ageMs = nowMs - Date.parse(createdAt);
		newestManifestPath = manifestPath;
		newestCreatedAt = createdAt;
		newestAgeMs = Number.isFinite(ageMs) ? ageMs : null;
	}
	return { newestManifestPath, newestCreatedAt, newestAgeMs, orphanCount };
}

function scanDailyReports(
	backupRoot: string,
): Pick<CriticalBackupHealth, 'lastDailyReportAt' | 'lastDailyOutcome'> {
	const reportRoot = join(backupRoot, 'reports');
	let lastDailyReportAt: string | null = null;
	let lastDailyOutcome: 'succeeded' | 'failed' | null = null;
	if (!existsSync(reportRoot)) return { lastDailyReportAt, lastDailyOutcome };
	for (const name of readdirSync(reportRoot)) {
		if (!name.startsWith('daily-backup-') || !name.endsWith('.json')) continue;
		const parsed = readJson(join(reportRoot, name)) as DailyBackupReportFile;
		const stamp = parsed.endedAt ?? parsed.startedAt;
		if (!stamp) continue;
		if (lastDailyReportAt != null && Date.parse(stamp) <= Date.parse(lastDailyReportAt)) {
			continue;
		}
		lastDailyReportAt = stamp;
		lastDailyOutcome =
			parsed.outcome === 'succeeded' || parsed.outcome === 'failed' ? parsed.outcome : null;
	}
	return { lastDailyReportAt, lastDailyOutcome };
}

function formatHealthSummary(input: {
	newestAgeMs: number | null;
	lastDailyReportAt: string | null;
	lastDailyOutcome: 'succeeded' | 'failed' | null;
	dailyAgeMs: number | null;
	orphanCount: number;
}): string {
	const newestLabel =
		input.newestAgeMs == null
			? 'sin set completo'
			: `último set ${formatAge(input.newestAgeMs)}`;
	const dailyFresh =
		input.lastDailyOutcome === 'succeeded' &&
		input.dailyAgeMs != null &&
		input.dailyAgeMs <= DAILY_BACKUP_RPO_MS;
	const dailyLabel =
		input.lastDailyReportAt == null
			? 'daily ausente'
			: dailyFresh
				? `daily ${formatAge(input.dailyAgeMs ?? 0)}`
				: `daily ${input.lastDailyOutcome === 'succeeded' ? formatAge(input.dailyAgeMs ?? 0) : (input.lastDailyOutcome ?? 'desconocido')}`;
	const orphanLabel = input.orphanCount > 0 ? ` · ${input.orphanCount} huérfano(s)` : '';
	return `${dailyLabel} · ${newestLabel}${orphanLabel}`;
}

export function evaluateCriticalBackupHealth(input?: {
	backupRoot?: string;
	nowMs?: number;
}): CriticalBackupHealth {
	const backupRoot = resolve(input?.backupRoot ?? DEFAULT_CRITICAL_BACKUP_ROOT);
	const nowMs = input?.nowMs ?? Date.now();
	const sets = scanCriticalSets(backupRoot, nowMs);
	const daily = scanDailyReports(backupRoot);
	const dailyAgeMs = daily.lastDailyReportAt ? nowMs - Date.parse(daily.lastDailyReportAt) : null;
	const dailyStale =
		daily.lastDailyOutcome !== 'succeeded' ||
		dailyAgeMs == null ||
		!Number.isFinite(dailyAgeMs) ||
		dailyAgeMs > DAILY_BACKUP_RPO_MS;
	return {
		...sets,
		...daily,
		attention: dailyStale || sets.orphanCount > 0,
		summary: formatHealthSummary({
			newestAgeMs: sets.newestAgeMs,
			lastDailyReportAt: daily.lastDailyReportAt,
			lastDailyOutcome: daily.lastDailyOutcome,
			dailyAgeMs,
			orphanCount: sets.orphanCount,
		}),
	};
}
