import { ReadableStream as NodeReadableStream } from 'node:stream/web';

export function createMockRequest(
	payload?: unknown,
	headers?: Record<string, string>,
	url = 'http://localhost/api/test',
): Request {
	const defaultHeaders: Record<string, string> = {};

	// Only add Content-Type if not explicitly overridden or removed
	if (headers && 'Content-Type' in headers) {
		if (headers['Content-Type'] !== '') {
			defaultHeaders['Content-Type'] = headers['Content-Type'];
		}
	} else {
		defaultHeaders['Content-Type'] = 'application/json';
	}

	// Add other headers
	if (headers) {
		for (const [key, value] of Object.entries(headers)) {
			if (key !== 'Content-Type' || value !== '') {
				defaultHeaders[key] = value;
			}
		}
	}
	const rawBody =
		payload === undefined || payload === null
			? null
			: typeof payload === 'string'
				? payload
				: JSON.stringify(payload);

	return {
		url,
		body: rawBody === null
			? null
			: new NodeReadableStream({
					start(controller) {
						controller.enqueue(new TextEncoder().encode(rawBody));
						controller.close();
					},
				}),
		json: async () => payload,
		text: async () => {
			return rawBody ?? '';
		},
		headers: {
			get: (name: string) => {
				const key = Object.keys(defaultHeaders).find(
					(headerName) => headerName.toLowerCase() === name.toLowerCase(),
				);
				return key ? (defaultHeaders[key] ?? null) : null;
			},
		} as Headers,
	} as unknown as Request;
}

export async function resolveAfterMicrotasks<T>(value: T, turns: number): Promise<T> {
	let pending = Promise.resolve();
	for (let turn = 0; turn < turns; turn += 1) {
		pending = pending.then(() => undefined);
	}
	await pending;
	return value;
}
