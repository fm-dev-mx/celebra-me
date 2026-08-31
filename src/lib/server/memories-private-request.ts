import { createHash, createPrivateKey, randomUUID, sign } from 'node:crypto';
import { getEnv } from '@/lib/server/env';
import {
	MEMORIES_PRIVATE_REQUEST_HEADERS,
	buildMemoriesPrivateRequestPayload,
} from '@/data/valentina-memories-private-request.contract';

function normalizePem(value: string): string {
	return value.trim().replace(/\\n/g, '\n');
}

export function createMemoriesPrivateRequestHeaders(input: {
	audience: string;
	method: string;
	path: string;
	body: string;
	privateKeyEnvName: string;
	requestId?: string;
	now?: Date;
}): Record<string, string> {
	const privateKeyPem = normalizePem(getEnv(input.privateKeyEnvName));
	if (!privateKeyPem) throw new Error('Memories private request signing is not configured.');
	const timestamp = String(Math.floor((input.now ?? new Date()).getTime() / 1000));
	const requestId = input.requestId ?? randomUUID();
	const bodyHash = createHash('sha256').update(input.body, 'utf8').digest('hex');
	const payload = buildMemoriesPrivateRequestPayload({
		audience: input.audience,
		timestamp,
		requestId,
		method: input.method,
		path: input.path,
		bodyHash,
	});
	const signature = sign('sha256', Buffer.from(payload, 'utf8'), {
		key: createPrivateKey(privateKeyPem),
		dsaEncoding: 'ieee-p1363',
	}).toString('base64url');
	return {
		'Content-Type': 'application/json',
		[MEMORIES_PRIVATE_REQUEST_HEADERS.audience]: input.audience,
		[MEMORIES_PRIVATE_REQUEST_HEADERS.timestamp]: timestamp,
		[MEMORIES_PRIVATE_REQUEST_HEADERS.requestId]: requestId,
		[MEMORIES_PRIVATE_REQUEST_HEADERS.signature]: signature,
	};
}
