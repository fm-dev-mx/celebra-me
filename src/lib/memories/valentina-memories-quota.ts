import type { ValentinaMemoriesGuestQuota } from '@/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_SESSION_MAX_BYTES,
	VALENTINA_MEMORIES_SESSION_MAX_FILES,
	VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT,
	VALENTINA_MEMORIES_SESSION_MAX_VIDEOS,
} from '@/data/valentina-memories-upload.contract';

type ResidentQuotaRow = {
	mime_type: string;
	size_bytes: number;
	status: string;
	object_deleted_at: string | null;
};

function quotaCounter(used: number, limit: number) {
	return { used, remaining: Math.max(0, limit - used), limit };
}

export function calculateValentinaMemoriesGuestQuota(
	rows: readonly ResidentQuotaRow[],
): ValentinaMemoriesGuestQuota {
	const resident = rows.filter((row) => row.object_deleted_at === null);
	const videos = resident.filter((row) => row.mime_type.startsWith('video/')).length;
	const bytes = resident.reduce((total, row) => total + Number(row.size_bytes), 0);
	const inFlight = resident.filter(
		(row) => row.status === 'uploading' || row.status === 'validating',
	).length;
	return {
		files: quotaCounter(resident.length, VALENTINA_MEMORIES_SESSION_MAX_FILES),
		videos: quotaCounter(videos, VALENTINA_MEMORIES_SESSION_MAX_VIDEOS),
		bytes: quotaCounter(bytes, VALENTINA_MEMORIES_SESSION_MAX_BYTES),
		inFlight: quotaCounter(inFlight, VALENTINA_MEMORIES_SESSION_MAX_IN_FLIGHT),
	};
}
