import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';

/** Complete keyset reads, independent of a provider's default row cap. Fail closed on overflow. */
export async function loadCommercialRows<T extends { id: string }>(query: string): Promise<T[]> {
	const rows: T[] = [];
	let cursor = '';
	for (let page = 0; page < 2000; page++) {
		const batch = await supabaseRestRequest<T[]>({
			pathWithQuery: `${query}&order=id.asc&limit=500${cursor ? `&id=gt.${encodeURIComponent(cursor)}` : ''}`,
			method: 'GET',
			useServiceRole: true,
		});
		if (batch.length === 0) return rows;
		const next = batch[batch.length - 1].id;
		if (!next || next <= cursor) throw new Error('Commercial pagination did not advance.');
		rows.push(...batch);
		cursor = next;
		if (rows.length > 100000)
			throw new Error('Commercial report exceeds the safe processing limit.');
	}
	throw new Error('Commercial pagination is incomplete.');
}
