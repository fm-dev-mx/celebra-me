import type { DbClient } from './types';
import { BUCKET } from './types';

export async function rollbackStorage(
	supabaseUrl: string,
	serviceRoleKey: string,
	paths: string[],
): Promise<void> {
	for (const storagePath of paths) {
		try {
			await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: `${serviceRoleKey}` },
			});
		} catch {
			console.warn(`[cleanup] Failed to delete storage object: ${storagePath}`);
		}
	}
}

export async function rollbackAssetRows(supabase: DbClient, ids: string[]): Promise<void> {
	const now = new Date().toISOString();
	for (const id of ids) {
		try {
			await supabase
				.from('invitation_assets')
				.update({ deleted_at: now } as Record<string, unknown>)
				.eq('id', id);
		} catch {
			console.warn(`[cleanup] Failed to soft-delete asset row: ${id}`);
		}
	}
}
