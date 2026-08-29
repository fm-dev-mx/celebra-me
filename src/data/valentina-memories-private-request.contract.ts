export const MEMORIES_PRIVATE_REQUEST_HEADERS = {
	audience: 'X-Celebra-Memories-Audience',
	timestamp: 'X-Celebra-Memories-Timestamp',
	requestId: 'X-Celebra-Memories-Request-Id',
	signature: 'X-Celebra-Memories-Signature',
} as const;

export const MEMORIES_PRIVATE_REQUEST_TTL_SECONDS = 60;
export const MEMORIES_UPLOAD_REQUEST_AUDIENCE = 'memories-upload-sign-v1' as const;
export const MEMORIES_RETRIEVAL_REQUEST_AUDIENCE = 'memories-private-retrieval-v1' as const;

export function buildMemoriesPrivateRequestPayload(input: {
	audience: string;
	timestamp: string;
	requestId: string;
	method: string;
	path: string;
	bodyHash: string;
}): string {
	return [
		'v1',
		input.audience,
		input.timestamp,
		input.requestId,
		input.method.toUpperCase(),
		input.path,
		input.bodyHash,
	].join('\n');
}
