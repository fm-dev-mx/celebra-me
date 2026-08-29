import {
	VALENTINA_MEMORIES_SIGN_PATH,
	VALENTINA_MEMORIES_UPLOAD_ORIGIN_ENV_NAME,
} from '@/data/valentina-memories-upload.contract';
import { resolveMemoriesPrivateWorkerUrl } from '@/lib/server/memories-private-worker-target';

/** Server-only origin plus repository-owned path. This module must never enter a client island. */
export function resolveMemoriesUploadSignerUrl(): URL | null {
	return resolveMemoriesPrivateWorkerUrl(
		VALENTINA_MEMORIES_UPLOAD_ORIGIN_ENV_NAME,
		VALENTINA_MEMORIES_SIGN_PATH,
	);
}
