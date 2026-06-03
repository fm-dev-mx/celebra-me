import { getSupabaseUrl, getSupabaseServiceRoleKey } from '@/lib/server/supabase-credentials';

const DEFAULT_BUCKET = 'invitation-assets';

function buildStorageUrl(bucket: string, path: string): string {
	return `${getSupabaseUrl()}/storage/v1/object/${bucket}/${path}`;
}

export function getPublicUrl(bucket: string, path: string): string {
	return `${getSupabaseUrl()}/storage/v1/object/public/${bucket}/${path}`;
}

export async function uploadToStorage(
	bucket: string,
	path: string,
	file: Blob,
	contentType: string,
): Promise<string> {
	const serviceRoleKey = getSupabaseServiceRoleKey();
	const url = buildStorageUrl(bucket, path);

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${serviceRoleKey}`,
			'Content-Type': contentType,
		},
		body: file,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`Storage upload failed (${response.status}): ${text || response.statusText}`,
		);
	}

	return getPublicUrl(bucket, path);
}

export { DEFAULT_BUCKET };
