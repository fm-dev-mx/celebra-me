import { supabaseRestRequest } from '@/lib/rsvp/supabase';

export interface RequestOptions {
	authToken?: string;
	useServiceRole?: boolean;
	prefer?: string;
}

export async function findSingle<TRow, TRecord>(
	table: string,
	query: string,
	columns: string,
	mapper: (row: TRow) => TRecord,
	options: RequestOptions = {},
): Promise<TRecord | null> {
	const rows = await supabaseRestRequest<TRow[]>({
		pathWithQuery: `${table}?select=${columns}&${query}&limit=1`,
		authToken: options.authToken,
		useServiceRole: options.useServiceRole,
	});
	return rows[0] ? mapper(rows[0]) : null;
}

export async function findMany<TRow, TRecord>(
	table: string,
	query: string,
	columns: string,
	mapper: (row: TRow) => TRecord,
	options: RequestOptions = {},
): Promise<TRecord[]> {
	const rows = await supabaseRestRequest<TRow[]>({
		pathWithQuery: `${table}?select=${columns}&${query}`,
		authToken: options.authToken,
		useServiceRole: options.useServiceRole,
	});
	return rows.map(mapper);
}

export async function insertSingle<TRow, TRecord>(
	table: string,
	columns: string,
	body: Record<string, unknown>,
	mapper: (row: TRow) => TRecord,
	options: RequestOptions = {},
): Promise<TRecord> {
	const rows = await supabaseRestRequest<TRow[]>({
		pathWithQuery: `${table}?select=${columns}`,
		method: 'POST',
		body,
		authToken: options.authToken,
		useServiceRole: options.useServiceRole,
		prefer: options.prefer || 'return=representation',
	});
	if (!rows[0]) throw new Error(`Failed to insert into ${table}`);
	return mapper(rows[0]);
}

export async function updateSingle<TRow, TRecord>(
	table: string,
	columns: string,
	query: string,
	body: Record<string, unknown>,
	mapper: (row: TRow) => TRecord,
	options: RequestOptions = {},
): Promise<TRecord> {
	const rows = await supabaseRestRequest<TRow[]>({
		pathWithQuery: `${table}?select=${columns}&${query}`,
		method: 'PATCH',
		body,
		authToken: options.authToken,
		useServiceRole: options.useServiceRole,
		prefer: options.prefer || 'return=representation',
	});
	if (!rows[0]) throw new Error(`Failed to update ${table}`);
	return mapper(rows[0]);
}

export async function deleteByQuery(
	table: string,
	query: string,
	options: RequestOptions = {},
): Promise<void> {
	await supabaseRestRequest({
		pathWithQuery: `${table}?${query}`,
		method: 'DELETE',
		authToken: options.authToken,
		useServiceRole: options.useServiceRole,
		prefer: options.prefer || 'return=minimal',
	});
}
