type ReplayStorage = {
	get<T = unknown>(key: string): Promise<T | undefined>;
	put<T>(key: string, value: T): Promise<void>;
	list<T = unknown>(): Promise<Map<string, T>>;
	delete(key: string): Promise<boolean>;
	setAlarm(scheduledTime: number | Date): Promise<void>;
};

type ReplayState = {
	storage: ReplayStorage;
	blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
};

export type ReplayGuardNamespace = {
	idFromName(name: string): { toString(): string };
	get(id: { toString(): string }): {
		fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
	};
};

type ReplayRecord = { expiresAt: number };

const REPLAY_REQUEST_MAX_BYTES = 8 * 1024;

async function readBoundedJson(request: Request): Promise<unknown> {
	const contentLength = request.headers.get('content-length');
	if (
		contentLength !== null &&
		(!/^\d+$/.test(contentLength.trim()) || Number(contentLength) > REPLAY_REQUEST_MAX_BYTES)
	) {
		throw new Error('request body too large');
	}
	if (!request.body) throw new Error('request body missing');
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!value) continue;
			total += value.byteLength;
			if (total > REPLAY_REQUEST_MAX_BYTES) {
				await reader.cancel('request body too large');
				throw new Error('request body too large');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder().decode(bytes));
}

/** A single-key Durable Object gives each nonce an atomic claim boundary. */
export class ReplayGuard {
	constructor(private readonly state: ReplayState) {}

	async fetch(request: Request): Promise<Response> {
		if (request.method !== 'POST') return new Response(null, { status: 405 });
		let input: { key?: unknown; expiresAt?: unknown };
		try {
			input = (await readBoundedJson(request)) as typeof input;
		} catch {
			return new Response(null, { status: 400 });
		}
		if (
			typeof input.key !== 'string' ||
			input.key.length < 8 ||
			input.key.length > 240 ||
			typeof input.expiresAt !== 'number' ||
			!Number.isSafeInteger(input.expiresAt)
		) {
			return new Response(null, { status: 400 });
		}

		const now = Date.now();
		const accepted = await this.state.blockConcurrencyWhile(async () => {
			const current = await this.state.storage.get<ReplayRecord>(input.key as string);
			if (current && current.expiresAt > now) return false;
			await this.state.storage.put(input.key as string, {
				expiresAt: input.expiresAt as number,
			});
			await this.state.storage.setAlarm(input.expiresAt as number);
			return true;
		});
		return new Response(null, { status: accepted ? 204 : 409 });
	}

	async alarm(): Promise<void> {
		const now = Date.now();
		const records = await this.state.storage.list<ReplayRecord>();
		for (const [key, record] of records) {
			if (record.expiresAt <= now) await this.state.storage.delete(key);
		}
	}
}

export async function consumeReplayKey(
	namespace: ReplayGuardNamespace | undefined,
	key: string,
	expiresAt: number,
): Promise<boolean> {
	if (!namespace) return false;
	const id = namespace.idFromName(key);
	const response = await namespace.get(id).fetch('https://replay-guard/claim', {
		method: 'POST',
		body: JSON.stringify({ key, expiresAt }),
		headers: { 'Content-Type': 'application/json' },
	});
	return response.status === 204;
}
