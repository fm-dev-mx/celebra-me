import { VALENTINA_MEMORIES_SIGN_PATH } from '@/data/valentina-memories-upload.contract';

/** Repository-owned server target. This module must never enter a client island. */
const MEMORIES_UPLOAD_SIGNER_ORIGIN = 'https://memories.celebra-me.com' as const;
export const MEMORIES_UPLOAD_SIGNER_URL = new URL(
	VALENTINA_MEMORIES_SIGN_PATH,
	MEMORIES_UPLOAD_SIGNER_ORIGIN,
).toString();
