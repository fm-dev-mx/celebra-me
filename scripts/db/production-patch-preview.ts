import type { SqlManifest } from './sql-safety.ts';

type ProductionPatchPreviewState = 'NOT_NEEDED' | 'PENDING' | 'BLOCKED';
type ProductionPatchPreviewReason =
	'ZERO_ROWS' | 'ROWS_WITHIN_RANGE' | 'ROWS_OUTSIDE_RANGE' | 'STORE_DISAGREEMENT';

interface ProductionPatchPreviewEvidence {
	total: number;
	keysByStore: Record<string, string[]> | null;
}

export interface ProductionPatchPreviewAssessment {
	state: ProductionPatchPreviewState;
	reason: ProductionPatchPreviewReason;
	evidence: ProductionPatchPreviewEvidence;
}

interface PairedStoreContract {
	stores: string[];
	keyColumns: string[];
}

function manifestList(value: string | undefined): string[] {
	return (value ?? '')
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function pairedStoreContract(manifest: SqlManifest): PairedStoreContract | null {
	const stores = manifestList(manifest['paired-stores']);
	const keyColumns = manifestList(manifest['pair-key']);
	if (stores.length === 0 && keyColumns.length === 0) return null;
	if (stores.length < 2 || keyColumns.length === 0) {
		throw new Error('PATCH_PREVIEW_PAIR_CONTRACT_INVALID');
	}
	const identifiers = [...stores, ...keyColumns];
	if (identifiers.some((value) => !/^[a-z][a-z0-9_]*$/i.test(value))) {
		throw new Error('PATCH_PREVIEW_PAIR_CONTRACT_INVALID');
	}
	return { stores: [...new Set(stores)], keyColumns: [...new Set(keyColumns)] };
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

export function buildProductionPatchPreviewSql(manifest: SqlManifest): string {
	const preview = manifest['dry-run-query'];
	if (!preview) throw new Error('PATCH_PREVIEW_REQUIRED');
	const contract = pairedStoreContract(manifest);
	if (!contract) {
		return `select count(*)::text from (${preview}) as patch_target;`;
	}
	const keyExpression = `json_build_array(${contract.keyColumns
		.map((column) => `patch_target.${quoteIdentifier(column)}::text`)
		.join(', ')})::text`;
	return `select coalesce(json_agg(json_build_object('store', patch_target."store"::text, 'key', ${keyExpression}) order by patch_target."store"::text, ${keyExpression})::text, '[]') from (${preview}) as patch_target;`;
}

export function parseProductionPatchPreview(
	manifest: SqlManifest,
	rawOutput: string,
): ProductionPatchPreviewEvidence {
	const contract = pairedStoreContract(manifest);
	const text = rawOutput.trim();
	if (!contract) {
		if (!/^\d+$/.test(text)) throw new Error('PATCH_PREVIEW_INVALID_OUTPUT');
		const total = Number(text);
		if (!Number.isSafeInteger(total)) throw new Error('PATCH_PREVIEW_INVALID_OUTPUT');
		return { total, keysByStore: null };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('PATCH_PREVIEW_INVALID_OUTPUT');
	}
	if (!Array.isArray(parsed)) throw new Error('PATCH_PREVIEW_INVALID_OUTPUT');
	const keysByStore = Object.fromEntries(contract.stores.map((store) => [store, [] as string[]]));
	for (const row of parsed) {
		if (!row || typeof row !== 'object') throw new Error('PATCH_PREVIEW_INVALID_OUTPUT');
		const store = (row as { store?: unknown }).store;
		const key = (row as { key?: unknown }).key;
		if (
			typeof store !== 'string' ||
			!contract.stores.includes(store) ||
			typeof key !== 'string' ||
			key.length === 0
		) {
			throw new Error('PATCH_PREVIEW_INVALID_OUTPUT');
		}
		keysByStore[store]!.push(key);
	}
	return { total: parsed.length, keysByStore };
}

function storeHasDuplicateKeys(keysByStore: Record<string, string[]>): boolean {
	return Object.values(keysByStore).some((keys) => new Set(keys).size !== keys.length);
}

export function assessProductionPatchPreview(input: {
	evidence: ProductionPatchPreviewEvidence;
	min: number;
	max: number;
}): ProductionPatchPreviewAssessment {
	if (input.evidence.total === 0) {
		return { state: 'NOT_NEEDED', reason: 'ZERO_ROWS', evidence: input.evidence };
	}
	if (input.evidence.keysByStore && storeHasDuplicateKeys(input.evidence.keysByStore)) {
		return {
			state: 'BLOCKED',
			reason: 'STORE_DISAGREEMENT',
			evidence: input.evidence,
		};
	}
	if (input.evidence.total < input.min || input.evidence.total > input.max) {
		return {
			state: 'BLOCKED',
			reason: 'ROWS_OUTSIDE_RANGE',
			evidence: input.evidence,
		};
	}
	return { state: 'PENDING', reason: 'ROWS_WITHIN_RANGE', evidence: input.evidence };
}
