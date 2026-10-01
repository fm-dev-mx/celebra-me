/**
 * R2 bucket configuration projected from the contract. The owner applies the
 * generated JSON files; nothing is edited directly in Cloudflare.
 */

import { MEMORIES_OBJECT_MAX_LIFETIME_SECONDS } from '../../src/lib/memories/contract/limits';
import { MEMORIES_OBJECT_PREFIX } from '../../src/lib/memories/contract/object-key';

const ABORT_MULTIPART_AFTER_SECONDS = 86_400;

/** Browsers never reach the bucket: uploads and reads go through the Workers. */
export function buildMemoriesR2CorsConfig() {
	return { rules: [{ allowed: { origins: [], methods: [], headers: [] } }] };
}

/** Final backstop: any object older than the maximum lifetime is removed. */
export function buildMemoriesR2LifecycleConfig() {
	return {
		rules: [
			{
				id: 'expire-event-memories',
				enabled: true,
				conditions: { prefix: MEMORIES_OBJECT_PREFIX },
				deleteObjectsTransition: {
					condition: { maxAge: MEMORIES_OBJECT_MAX_LIFETIME_SECONDS, type: 'Age' },
				},
				abortMultipartUploadsTransition: {
					condition: { maxAge: ABORT_MULTIPART_AFTER_SECONDS, type: 'Age' },
				},
			},
		],
	};
}
