/** Reads a request body up to `maxBytes`; returns null when the limit is exceeded. */
export async function readBoundedBody(
	request: Request,
	maxBytes: number,
): Promise<Uint8Array | null> {
	const rawLength = request.headers.get('Content-Length');
	if (rawLength !== null) {
		if (!/^\d+$/.test(rawLength.trim())) return null;
		if (Number(rawLength) > maxBytes) return null;
	}
	if (!request.body) return null;
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel('request body exceeds configured limit');
				return null;
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body;
}

export async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
	const bytes = await readBoundedBody(request, maxBytes);
	return bytes === null ? null : new TextDecoder().decode(bytes);
}
