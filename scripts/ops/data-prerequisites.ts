import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Data prerequisites: facts about the data of a target environment that application code assumes
 * and that no schema migration delivers (for example, a backfill of Auth metadata through the
 * admin API). `supabase/data-prerequisites.json` declares them, and the release gate refuses a
 * Production release while one of them has no verified evidence. See "Data prerequisites" in
 * `docs/core/release-process.md`.
 */
export const DATA_PREREQUISITES_PATH = 'supabase/data-prerequisites.json';
export const DATA_PREREQUISITE_DOCS = 'docs/core/release-process.md ("Data prerequisites")';

export type DataPrerequisiteStatus = 'verified' | 'pending' | 'not-applicable';
const STATUSES: ReadonlySet<string> = new Set(['verified', 'pending', 'not-applicable']);

export interface DataPrerequisiteEnvironment {
	status: DataPrerequisiteStatus;
	verifiedAt?: string;
	evidence?: string;
}

export interface DataPrerequisite {
	id: string;
	summary: string;
	introducedBy: string;
	verify: string;
	environments: Record<string, DataPrerequisiteEnvironment>;
}

export type AuthAppMetadataKeyDeclaration =
	{ prerequisite: string } | { migration: 'none'; reason: string };

export interface DataPrerequisiteManifest {
	version: 1;
	authAppMetadataKeys: Record<string, AuthAppMetadataKeyDeclaration>;
	prerequisites: DataPrerequisite[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
	typeof value === 'string' && value.trim() !== '';

function invalid(detail: string): Error {
	return new Error(
		`${DATA_PREREQUISITES_PATH} is invalid: ${detail} See ${DATA_PREREQUISITE_DOCS}.`,
	);
}

function parseEnvironment(id: string, name: string, value: unknown): DataPrerequisiteEnvironment {
	if (!isRecord(value) || !STATUSES.has(String(value.status)))
		throw invalid(
			`prerequisite "${id}" needs a status of verified, pending or not-applicable for ${name}.`,
		);
	const status = value.status as DataPrerequisiteStatus;
	if (status === 'verified') {
		if (!isText(value.verifiedAt) || !/^\d{4}-\d{2}-\d{2}$/u.test(value.verifiedAt))
			throw invalid(
				`prerequisite "${id}" is verified for ${name} without a verifiedAt date.`,
			);
		if (!isText(value.evidence))
			throw invalid(`prerequisite "${id}" is verified for ${name} without evidence.`);
	}
	if (status === 'not-applicable' && !isText(value.evidence))
		throw invalid(
			`prerequisite "${id}" is not-applicable for ${name} without an evidence line saying why.`,
		);
	return {
		status,
		...(isText(value.verifiedAt) ? { verifiedAt: value.verifiedAt } : {}),
		...(isText(value.evidence) ? { evidence: value.evidence } : {}),
	};
}

function parsePrerequisite(value: unknown): DataPrerequisite {
	if (!isRecord(value) || !isText(value.id)) throw invalid('every prerequisite needs an id.');
	const { id } = value;
	for (const field of ['summary', 'introducedBy', 'verify'] as const)
		if (!isText(value[field])) throw invalid(`prerequisite "${id}" needs "${field}".`);
	if (!isRecord(value.environments))
		throw invalid(`prerequisite "${id}" needs an "environments" object.`);
	const environments: Record<string, DataPrerequisiteEnvironment> = {};
	for (const [name, environment] of Object.entries(value.environments))
		environments[name] = parseEnvironment(id, name, environment);
	return {
		id,
		summary: value.summary as string,
		introducedBy: value.introducedBy as string,
		verify: value.verify as string,
		environments,
	};
}

export function parseDataPrerequisiteManifest(text: string): DataPrerequisiteManifest {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw invalid('it is not valid JSON.');
	}
	if (!isRecord(raw) || raw.version !== 1) throw invalid('"version" must be 1.');
	if (!Array.isArray(raw.prerequisites)) throw invalid('"prerequisites" must be a list.');
	if (!isRecord(raw.authAppMetadataKeys))
		throw invalid('"authAppMetadataKeys" must be an object.');
	const prerequisites = raw.prerequisites.map(parsePrerequisite);
	const ids = new Set<string>();
	for (const { id } of prerequisites) {
		if (ids.has(id)) throw invalid(`prerequisite "${id}" is declared twice.`);
		ids.add(id);
	}
	const authAppMetadataKeys: Record<string, AuthAppMetadataKeyDeclaration> = {};
	for (const [key, declaration] of Object.entries(raw.authAppMetadataKeys)) {
		if (!isRecord(declaration)) throw invalid(`app_metadata key "${key}" needs a declaration.`);
		if (isText(declaration.prerequisite)) {
			if (!ids.has(declaration.prerequisite))
				throw invalid(
					`app_metadata key "${key}" names the unknown prerequisite "${declaration.prerequisite}".`,
				);
			authAppMetadataKeys[key] = { prerequisite: declaration.prerequisite };
		} else if (declaration.migration === 'none' && isText(declaration.reason)) {
			authAppMetadataKeys[key] = { migration: 'none', reason: declaration.reason };
		} else {
			throw invalid(
				`app_metadata key "${key}" needs either "prerequisite" or "migration": "none" with a "reason".`,
			);
		}
	}
	return { version: 1, authAppMetadataKeys, prerequisites };
}

/**
 * Refuses a release while a prerequisite lacks verified evidence for the target environment.
 * `manifestText` is the manifest at the exact SHA being released, or null when that commit has none.
 */
export function requireDataPrerequisites(
	manifestText: string | null,
	environment = 'production',
): DataPrerequisite[] {
	if (manifestText === null)
		throw new Error(
			`Data prerequisites are unknown: ${DATA_PREREQUISITES_PATH} could not be read at the release SHA. ` +
				`The commit predates the manifest or GitHub is unreachable. See ${DATA_PREREQUISITE_DOCS}.`,
		);
	const manifest = parseDataPrerequisiteManifest(manifestText);
	const blocked = manifest.prerequisites.filter((prerequisite) => {
		const status = prerequisite.environments[environment]?.status;
		return status !== 'verified' && status !== 'not-applicable';
	});
	if (blocked.length > 0)
		throw new Error(
			[
				`Data prerequisites are not verified for ${environment}; do not activate this release:`,
				...blocked.map(
					(prerequisite) =>
						`- ${prerequisite.id}: ${prerequisite.summary} Verify with \`${prerequisite.verify}\`.`,
				),
				`Run the verification against ${environment}, then record the result in ${DATA_PREREQUISITES_PATH}. ` +
					`See ${DATA_PREREQUISITE_DOCS}.`,
			].join('\n'),
		);
	return manifest.prerequisites;
}

const SOURCE_FILE = /\.(?:ts|tsx|mts|js|mjs|astro)$/u;
/**
 * Matches `app_metadata.key`, `app_metadata?.key`, `app_metadata['key']` and `app_metadata?.['key']`.
 * It cannot see a key reached through a constant (`app_metadata[SOME_KEY]`), destructuring, or a
 * helper that receives the whole object; declare those keys by hand when adding them.
 */
const APP_METADATA_KEY =
	/\bapp_metadata\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)|\bapp_metadata\s*(?:\?\.)?\s*\[\s*['"`]([^'"`]+)['"`]\s*\]/gu;

export interface AppMetadataKeyRead {
	key: string;
	file: string;
	line: number;
}

export function findAppMetadataKeyReads(source: string, file: string): AppMetadataKeyRead[] {
	const reads: AppMetadataKeyRead[] = [];
	for (const match of source.matchAll(APP_METADATA_KEY)) {
		const key = match[1] ?? match[2];
		if (!key) continue;
		reads.push({ key, file, line: source.slice(0, match.index).split('\n').length });
	}
	return reads;
}

export function scanAppMetadataKeyReads(root: string): AppMetadataKeyRead[] {
	const reads: AppMetadataKeyRead[] = [];
	const walk = (directory: string, relative: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			const name = relative ? `${relative}/${entry.name}` : entry.name;
			if (entry.isDirectory()) walk(path, name);
			else if (SOURCE_FILE.test(entry.name))
				reads.push(...findAppMetadataKeyReads(readFileSync(path, 'utf8'), name));
		}
	};
	walk(root, '');
	return reads;
}

/** Reads of an `app_metadata` key that the manifest does not declare. */
export function findUndeclaredAppMetadataKeys(
	reads: readonly AppMetadataKeyRead[],
	manifest: DataPrerequisiteManifest,
): AppMetadataKeyRead[] {
	return reads.filter((read) => !Object.hasOwn(manifest.authAppMetadataKeys, read.key));
}

export function describeUndeclaredAppMetadataKeys(reads: readonly AppMetadataKeyRead[]): string {
	return [
		'Application code reads Auth app_metadata keys that are not declared:',
		...reads.map((read) => `- ${read.key} (${read.file}:${read.line})`),
		`Declare each key under "authAppMetadataKeys" in ${DATA_PREREQUISITES_PATH}: either ` +
			'{"migration": "none", "reason": "…"} when existing accounts need no data, or ' +
			'{"prerequisite": "<id>"} plus a prerequisite entry when they need a backfill. ' +
			`See ${DATA_PREREQUISITE_DOCS}.`,
	].join('\n');
}
