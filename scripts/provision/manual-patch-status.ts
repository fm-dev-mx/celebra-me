/** Read-only operational evidence for paired-store production patches. */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';
import { prepareProductionPatchFile, type PreparedProductionPatch } from '../db/run-prod-patch.ts';
import { resolveDbUrlForEnv, type TargetEnv } from './dbs-status.ts';
import { extractSupabaseProjectRef } from '../db/db-target-config.ts';
import { mapPool, type StatusProbeSession } from '../status-core/index.ts';
import {
	assessProductionPatchPreview,
	buildProductionPatchPreviewSql,
	parseProductionPatchPreview,
} from '../db/production-patch-preview.ts';
import { productionPatchApplyCommand, type SqlManifest } from '../db/sql-safety.ts';
import type {
	EvidenceState,
	ManualPatchEnvironmentStatus,
	ManualPatchAffectedRow,
	ManualPatchStatus,
	PatchApplicability,
	PatchEvidenceReason,
} from '../../src/lib/status/types.ts';

export interface ActiveManualPatchCatalogEntry {
	scriptId: string;
	file: string;
	purpose: string;
	targetEnvironments: readonly TargetEnv[];
	expectedRowsMin: number;
	expectedRowsMax: number;
}

export const MANUAL_PATCH_DIRECTORY = 'scripts/manual/production-patches';
export const MAX_ACTIVE_MANUAL_PATCHES = 50;

function headerLines(sql: string): string {
	const lines: string[] = [];
	for (const line of sql.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed !== '' && !trimmed.startsWith('--')) break;
		lines.push(line);
	}
	return lines.join('\n');
}

function headerField(header: string, name: string): string | null {
	const match = header.match(new RegExp(`^--\\s*@${name}:\\s*(.+)$`, 'im'));
	const value = match?.[1]?.trim();
	return value ? value : null;
}

function declaresPairedStores(sql: string): boolean {
	return /--\s*@paired-stores:\s*\S+/.test(headerLines(sql));
}

function fallbackCatalogEntry(file: string, sql: string): ActiveManualPatchCatalogEntry {
	const header = headerLines(sql);
	const min = Number(headerField(header, 'expected-rows-min') ?? '0');
	const max = Number(headerField(header, 'expected-rows-max') ?? '0');
	return {
		scriptId: headerField(header, 'script-id') ?? basename(file, '.sql'),
		file,
		purpose: headerField(header, 'purpose') ?? 'Invalid paired-store production patch',
		targetEnvironments: ['production'],
		expectedRowsMin: Number.isSafeInteger(min) ? min : 0,
		expectedRowsMax: Number.isSafeInteger(max) ? max : 0,
	};
}

export function discoverActiveManualPatches(
	rootDir: string = process.cwd(),
): ActiveManualPatchCatalogEntry[] {
	const directory = resolve(rootDir, MANUAL_PATCH_DIRECTORY);
	const names = readdirSync(directory)
		.filter((name) => name.endsWith('.sql'))
		.sort((left, right) => left.localeCompare(right));
	const entries: ActiveManualPatchCatalogEntry[] = [];
	for (const name of names) {
		const file = `${MANUAL_PATCH_DIRECTORY}/${name}`;
		const sql = readFileSync(resolve(directory, name), 'utf8');
		if (!declaresPairedStores(sql)) continue;
		try {
			const prepared = prepareProductionPatchFile(file);
			entries.push({
				scriptId: prepared.manifest['script-id'] ?? basename(name, '.sql'),
				file,
				purpose: prepared.manifest.purpose ?? 'Paired-store production patch',
				targetEnvironments: ['production'],
				expectedRowsMin: Number(prepared.manifest['expected-rows-min']),
				expectedRowsMax: Number(prepared.manifest['expected-rows-max']),
			});
		} catch {
			entries.push(fallbackCatalogEntry(file, sql));
		}
	}
	if (entries.length > MAX_ACTIVE_MANUAL_PATCHES) {
		throw new Error('ACTIVE_MANUAL_PATCH_CATALOG_OVERFLOW');
	}
	return entries;
}

export const ACTIVE_MANUAL_PATCH_CATALOG: readonly ActiveManualPatchCatalogEntry[] =
	discoverActiveManualPatches();

const ENVS: readonly TargetEnv[] = ['local', 'preview', 'production'];

export interface ManualPatchCatalogValidation {
	valid: boolean;
	errors: string[];
}

function isApprovedPath(file: string): boolean {
	if (!/^scripts\/manual\/production-patches\/[A-Za-z0-9_.-]+\.sql$/.test(file)) return false;
	const root = resolve(process.cwd(), 'scripts/manual/production-patches');
	const target = resolve(process.cwd(), file);
	const rel = relative(root, target);
	return rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.includes(`..${sep}`);
}

export function validateManualPatchCatalog(
	catalog: readonly ActiveManualPatchCatalogEntry[] = ACTIVE_MANUAL_PATCH_CATALOG,
): ManualPatchCatalogValidation {
	const errors: string[] = [];
	if (catalog.length > MAX_ACTIVE_MANUAL_PATCHES) errors.push('CATALOG_OVERFLOW');
	const ids = new Set<string>();
	for (const entry of catalog) {
		if (ids.has(entry.scriptId)) errors.push('DUPLICATE_SCRIPT_ID');
		ids.add(entry.scriptId);
		if (!isApprovedPath(entry.file)) errors.push('UNAPPROVED_PATCH_PATH');
		if (
			entry.targetEnvironments.length === 0 ||
			entry.targetEnvironments.some((env) => env !== 'production')
		) {
			errors.push('INVALID_PATCH_TARGET');
		}
		if (
			!Number.isSafeInteger(entry.expectedRowsMin) ||
			!Number.isSafeInteger(entry.expectedRowsMax) ||
			entry.expectedRowsMin > entry.expectedRowsMax
		) {
			errors.push('INVALID_EXPECTED_ROW_RANGE');
		}
		try {
			const prepared = prepareProductionPatchFile(entry.file);
			if (prepared.manifest['script-id'] !== entry.scriptId)
				errors.push('SCRIPT_ID_MANIFEST_MISMATCH');
			if (prepared.manifest.env !== 'production')
				errors.push('ENVIRONMENT_MANIFEST_MISMATCH');
			if (!prepared.manifest['dry-run-query']) errors.push('DRY_RUN_QUERY_MISSING');
			if (
				Number(prepared.manifest['expected-rows-min']) !== entry.expectedRowsMin ||
				Number(prepared.manifest['expected-rows-max']) !== entry.expectedRowsMax
			)
				errors.push('ROW_RANGE_MANIFEST_MISMATCH');
		} catch {
			errors.push('MANIFEST_OR_SQL_INVALID');
		}
	}
	return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function entryHasCatalogError(
	entry: ActiveManualPatchCatalogEntry,
	catalog: readonly ActiveManualPatchCatalogEntry[],
): boolean {
	const duplicateId =
		catalog.filter((candidate) => candidate.scriptId === entry.scriptId).length > 1;
	return (
		duplicateId ||
		!isApprovedPath(entry.file) ||
		entry.targetEnvironments.length === 0 ||
		entry.targetEnvironments.some((env) => env !== 'production') ||
		!Number.isSafeInteger(entry.expectedRowsMin) ||
		!Number.isSafeInteger(entry.expectedRowsMax) ||
		entry.expectedRowsMin > entry.expectedRowsMax
	);
}

function staticStatus(
	status: PatchApplicability,
	evidence: EvidenceState,
	reason: PatchEvidenceReason,
	matchingRowCount: number | null = null,
	verifiedAt: string | null = null,
	planCommand: string | null = null,
	affectedRows?: ManualPatchAffectedRow[] | null,
	projectRef?: string | null,
): ManualPatchEnvironmentStatus {
	const result: ManualPatchEnvironmentStatus = {
		status,
		evidence,
		matchingRowCount,
		verifiedAt,
		reason,
		planCommand,
	};
	if (affectedRows !== undefined) result.affectedRows = affectedRows;
	if (projectRef !== undefined) result.projectRef = projectRef;
	return result;
}

function baseStatus(entry: ActiveManualPatchCatalogEntry): ManualPatchStatus {
	return {
		scriptId: entry.scriptId,
		file: entry.file,
		purpose: entry.purpose,
		targetEnvironments: [...entry.targetEnvironments],
		expectedRowsMin: entry.expectedRowsMin,
		expectedRowsMax: entry.expectedRowsMax,
		environments: {
			local: staticStatus('NOT_APPLICABLE', 'LIVE', 'ENVIRONMENT_NOT_TARGET'),
			preview: staticStatus('NOT_APPLICABLE', 'LIVE', 'ENVIRONMENT_NOT_TARGET'),
			production: staticStatus('UNVERIFIED', 'UNVERIFIED', 'ENVIRONMENT_NOT_PROBED'),
		},
	};
}

export function buildUnverifiedManualPatchStatuses(
	catalog: readonly ActiveManualPatchCatalogEntry[] = ACTIVE_MANUAL_PATCH_CATALOG,
): ManualPatchStatus[] {
	const valid = validateManualPatchCatalog(catalog).valid;
	return catalog.map((entry) => {
		const status = baseStatus(entry);
		if (!valid)
			status.environments.production = staticStatus('BLOCKED', 'LIVE', 'CATALOG_INVALID');
		return status;
	});
}

export interface PatchPreviewResult {
	status: number | null;
	stdout: string;
	stderr?: string;
}

export function classifyPatchPreviewResult(input: {
	result: PatchPreviewResult;
	min: number;
	max: number;
	manifest?: SqlManifest;
	sql?: string;
	timedOut?: boolean;
	verifiedAt?: string;
	projectRef?: string | null;
}): ManualPatchEnvironmentStatus {
	const verifiedAt = input.verifiedAt ?? new Date().toISOString();
	if (input.timedOut || input.result.stderr?.includes('STATUS_PROBE_TIMEOUT')) {
		return staticStatus(
			'UNVERIFIED',
			'UNVERIFIED',
			'QUERY_TIMEOUT',
			null,
			verifiedAt,
			null,
			null,
			input.projectRef,
		);
	}
	if (input.result.status !== 0) {
		return staticStatus(
			'UNVERIFIED',
			'UNVERIFIED',
			'QUERY_FAILED',
			null,
			verifiedAt,
			null,
			null,
			input.projectRef,
		);
	}
	let assessment;
	try {
		const evidence = parseProductionPatchPreview(input.manifest ?? {}, input.result.stdout);
		assessment = assessProductionPatchPreview({
			evidence,
			min: input.min,
			max: input.max,
		});
	} catch {
		return staticStatus(
			'UNVERIFIED',
			'UNVERIFIED',
			'QUERY_INVALID_OUTPUT',
			null,
			verifiedAt,
			null,
			null,
			input.projectRef,
		);
	}
	const count = assessment.evidence.total;
	const affectedRows =
		assessment.evidence.rows?.map((row) => {
			const selectedSlug = row.row?.slug;
			const keyParts = (() => {
				try {
					const parsed = JSON.parse(row.key) as unknown;
					return Array.isArray(parsed) ? parsed : [];
				} catch {
					return [];
				}
			})();
			const slug =
				typeof selectedSlug === 'string'
					? selectedSlug
					: keyParts.length === 1 && typeof keyParts[0] === 'string'
						? keyParts[0]
						: null;
			const selectedVersion = row.row?.version;
			const version =
				typeof selectedVersion === 'number' &&
				Number.isSafeInteger(selectedVersion) &&
				selectedVersion >= 0
					? selectedVersion
					: null;
			return { store: row.store, key: row.key, slug, version };
		}) ?? null;
	if (assessment.state === 'NOT_NEEDED') {
		return staticStatus(
			'NOT_NEEDED',
			'LIVE',
			'LIVE_ZERO_ROWS',
			count,
			verifiedAt,
			null,
			affectedRows,
			input.projectRef,
		);
	}
	if (assessment.reason === 'STORE_DISAGREEMENT') {
		return staticStatus(
			'BLOCKED',
			'LIVE',
			'LIVE_STORE_DISAGREEMENT',
			count,
			verifiedAt,
			null,
			affectedRows,
			input.projectRef,
		);
	}
	if (assessment.state === 'BLOCKED') {
		return staticStatus(
			'BLOCKED',
			'LIVE',
			'LIVE_ROWS_OUTSIDE_RANGE',
			count,
			verifiedAt,
			null,
			affectedRows,
			input.projectRef,
		);
	}
	return staticStatus(
		'PENDING',
		'LIVE',
		'LIVE_ROWS_WITHIN_RANGE',
		count,
		verifiedAt,
		productionPatchApplyCommand('<file>', input.sql ?? ''),
		affectedRows,
		input.projectRef,
	);
}

function projectRefFromDbUrl(dbUrl: string): string | null {
	try {
		return extractSupabaseProjectRef(dbUrl);
	} catch {
		return null;
	}
}

function preparedForEntry(
	entry: ActiveManualPatchCatalogEntry,
): { prepared: PreparedProductionPatch; error: null } | { prepared: null; error: string } {
	try {
		const prepared = prepareProductionPatchFile(entry.file);
		const manifest = prepared.manifest;
		if (manifest['script-id'] !== entry.scriptId)
			return { prepared: null, error: 'SCRIPT_ID_MISMATCH' };
		if (manifest.env !== 'production')
			return { prepared: null, error: 'ENVIRONMENT_MANIFEST_MISMATCH' };
		if (
			Number(manifest['expected-rows-min']) !== entry.expectedRowsMin ||
			Number(manifest['expected-rows-max']) !== entry.expectedRowsMax
		) {
			return { prepared: null, error: 'ROW_RANGE_MANIFEST_MISMATCH' };
		}
		if (!manifest['dry-run-query']) return { prepared: null, error: 'DRY_RUN_QUERY_MISSING' };
		return { prepared, error: null };
	} catch {
		return { prepared: null, error: 'MANIFEST_OR_SQL_INVALID' };
	}
}

export async function readManualPatchStatuses(options: {
	session: StatusProbeSession;
	environments?: readonly TargetEnv[];
	catalog?: readonly ActiveManualPatchCatalogEntry[];
}): Promise<ManualPatchStatus[]> {
	const catalog = options.catalog ?? ACTIVE_MANUAL_PATCH_CATALOG;
	const requested = new Set(options.environments ?? ['production']);
	return await mapPool(catalog, 2, async (entry) => {
		const status = baseStatus(entry);
		try {
			const preparedResult = entryHasCatalogError(entry, catalog)
				? { prepared: null, error: 'CATALOG_INVALID' }
				: preparedForEntry(entry);
			if (!preparedResult.prepared) {
				status.environments.production = staticStatus('BLOCKED', 'LIVE', 'CATALOG_INVALID');
				return status;
			}
			for (const env of ENVS) {
				if (!entry.targetEnvironments.includes(env)) continue;
				if (!requested.has(env)) {
					status.environments[env] = staticStatus(
						'UNVERIFIED',
						'UNVERIFIED',
						'ENVIRONMENT_NOT_PROBED',
					);
					continue;
				}
				const { dbUrl } = resolveDbUrlForEnv(env);
				if (!dbUrl) {
					status.environments[env] = staticStatus(
						'UNVERIFIED',
						'UNVERIFIED',
						'QUERY_FAILED',
						null,
						new Date().toISOString(),
					);
					continue;
				}
				const verifiedAt = new Date().toISOString();
				const projectRef = projectRefFromDbUrl(dbUrl);
				const result = await options.session.psql(
					buildProductionPatchPreviewSql(preparedResult.prepared.manifest),
					dbUrl,
					{ tuplesOnly: true },
				);
				status.environments[env] = classifyPatchPreviewResult({
					result,
					min: entry.expectedRowsMin,
					max: entry.expectedRowsMax,
					manifest: preparedResult.prepared.manifest,
					sql: preparedResult.prepared.sql,
					verifiedAt,
					projectRef,
				});
			}
		} catch {
			status.environments.production = staticStatus(
				'UNVERIFIED',
				'UNVERIFIED',
				'QUERY_FAILED',
				null,
				new Date().toISOString(),
			);
		}
		return status;
	});
}
