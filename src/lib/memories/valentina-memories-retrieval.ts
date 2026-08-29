import {
	VALENTINA_MEMORIES_RETRIEVAL_ORIGIN_ENV_NAME,
	VALENTINA_MEMORIES_RETRIEVAL_PATH,
	VALENTINA_MEMORIES_RETRIEVAL_REQUEST_TTL_SECONDS,
	VALENTINA_MEMORIES_RETRIEVAL_SIGNING_PRIVATE_KEY_ENV_NAME,
} from '@/data/valentina-memories-media.contract';
import { MEMORIES_RETRIEVAL_REQUEST_AUDIENCE } from '@/data/valentina-memories-private-request.contract';
import { createMemoriesPrivateRequestHeaders } from '@/lib/server/memories-private-request';
import { resolveMemoriesPrivateWorkerUrl } from '@/lib/server/memories-private-worker-target';

type RetrievalMode = 'inline' | 'attachment' | 'inspect' | 'delete';

export type ValentinaMemoryInspectionResult = {
	exists: boolean;
	sizeBytes: number;
	checksumSha256: string | null;
	signatureValid: boolean;
	durationSeconds: number | null;
};

function resolveRetrievalUrl(): URL | null {
	return resolveMemoriesPrivateWorkerUrl(
		VALENTINA_MEMORIES_RETRIEVAL_ORIGIN_ENV_NAME,
		VALENTINA_MEMORIES_RETRIEVAL_PATH,
	);
}

function parseRange(value: string | null | undefined): {
	rangeStart: number | null;
	rangeEnd: number | null;
} {
	if (!value) return { rangeStart: null, rangeEnd: null };
	const match = /^bytes=(\d+)-(\d*)$/.exec(value.trim());
	if (!match) return { rangeStart: null, rangeEnd: null };
	const rangeStart = Number(match[1]);
	const rangeEnd = match[2] ? Number(match[2]) : null;
	if (
		!Number.isSafeInteger(rangeStart) ||
		rangeStart < 0 ||
		(rangeEnd !== null && (!Number.isSafeInteger(rangeEnd) || rangeEnd < rangeStart))
	) {
		return { rangeStart: null, rangeEnd: null };
	}
	return { rangeStart, rangeEnd };
}

export async function retrieveValentinaMemoryObject(input: {
	objectKey: string;
	mimeType: string;
	downloadName: string;
	mode: RetrievalMode;
	range?: string | null;
}): Promise<Response> {
	const retrievalUrl = resolveRetrievalUrl();
	if (!retrievalUrl) return new Response('Private retrieval is not configured.', { status: 503 });
	const requestBody: Record<string, unknown> = {
		objectKey: input.objectKey,
		mimeType: input.mimeType,
		mode: input.mode,
	};
	if (input.mode === 'inline' || input.mode === 'attachment') {
		requestBody.downloadName = input.downloadName;
		Object.assign(requestBody, parseRange(input.range));
	}
	const body = JSON.stringify(requestBody);
	return fetch(retrievalUrl, {
		method: 'POST',
		headers: createMemoriesPrivateRequestHeaders({
			audience: MEMORIES_RETRIEVAL_REQUEST_AUDIENCE,
			method: 'POST',
			path: VALENTINA_MEMORIES_RETRIEVAL_PATH,
			body,
			privateKeyEnvName: VALENTINA_MEMORIES_RETRIEVAL_SIGNING_PRIVATE_KEY_ENV_NAME,
		}),
		body,
		signal: AbortSignal.timeout((VALENTINA_MEMORIES_RETRIEVAL_REQUEST_TTL_SECONDS + 10) * 1000),
	});
}

export async function inspectValentinaMemoryObject(input: {
	objectKey: string;
	mimeType: string;
}): Promise<ValentinaMemoryInspectionResult | null> {
	const response = await retrieveValentinaMemoryObject({
		...input,
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

export async function deleteValentinaMemoryObject(input: {
	objectKey: string;
	mimeType: string;
}): Promise<boolean> {
	const response = await retrieveValentinaMemoryObject({
		...input,
		downloadName: 'delete',
		mode: 'delete',
	});
	return response.ok;
}
