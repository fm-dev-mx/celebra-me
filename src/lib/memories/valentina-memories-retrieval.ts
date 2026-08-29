import { createHash, createHmac } from 'node:crypto';
import { getEnv } from '@/lib/server/env';
import {
	VALENTINA_MEMORIES_RETRIEVAL_PATH,
	VALENTINA_MEMORIES_RETRIEVAL_REQUEST_TTL_SECONDS,
	VALENTINA_MEMORIES_RETRIEVAL_SECRET_ENV_NAME,
	VALENTINA_MEMORIES_RETRIEVAL_URL_ENV_NAME,
	buildValentinaMemoriesRetrievalSigningPayload,
} from '@/data/valentina-memories-media.contract';

type RetrievalMode = 'inline' | 'attachment' | 'inspect';

export type ValentinaMemoryInspectionResult = {
	exists: boolean;
	sizeBytes: number;
	checksumSha256: string | null;
	signatureValid: boolean;
	durationSeconds: number | null;
};

function sha256(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

function resolveRetrievalUrl(): string | null {
	const raw = getEnv(VALENTINA_MEMORIES_RETRIEVAL_URL_ENV_NAME).trim();
	if (!raw) return null;
	try {
		const url = new URL(raw);
		if (url.protocol !== 'https:' || url.pathname !== VALENTINA_MEMORIES_RETRIEVAL_PATH)
			return null;
		if (url.username || url.password || url.search || url.hash) return null;
		return url.toString();
	} catch {
		return null;
	}
}

export async function retrieveValentinaMemoryObject(input: {
	objectKey: string;
	mimeType: string;
	downloadName: string;
	mode: RetrievalMode;
}): Promise<Response> {
	const retrievalUrl = resolveRetrievalUrl();
	const secret = getEnv(VALENTINA_MEMORIES_RETRIEVAL_SECRET_ENV_NAME).trim();
	if (!retrievalUrl || !secret) {
		return new Response('Private retrieval is not configured.', { status: 503 });
	}
	const body = JSON.stringify({
		objectKey: input.objectKey,
		mimeType: input.mimeType,
		downloadName: input.downloadName,
		mode: input.mode,
	});
	const timestamp = String(Math.floor(Date.now() / 1000));
	const path = new URL(retrievalUrl).pathname;
	const payload = buildValentinaMemoriesRetrievalSigningPayload({
		timestamp,
		method: 'POST',
		path,
		bodyHash: sha256(body),
	});
	const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
	return fetch(retrievalUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Celebra-Retrieval-Timestamp': timestamp,
			'X-Celebra-Retrieval-Signature': signature,
		},
		body,
		signal: AbortSignal.timeout((VALENTINA_MEMORIES_RETRIEVAL_REQUEST_TTL_SECONDS + 10) * 1000),
	});
}

export async function inspectValentinaMemoryObject(input: {
	objectKey: string;
	mimeType: string;
}): Promise<ValentinaMemoryInspectionResult | null> {
	const response = await retrieveValentinaMemoryObject({
		objectKey: input.objectKey,
		mimeType: input.mimeType,
		downloadName: 'inspect',
		mode: 'inspect',
	});
	if (!response.ok) return null;
	try {
		return (await response.json()) as ValentinaMemoryInspectionResult;
	} catch {
		return null;
	}
}
