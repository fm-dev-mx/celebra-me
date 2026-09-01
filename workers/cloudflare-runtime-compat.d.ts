/**
 * Narrow runtime shapes shared by the app type-check and Worker tests.
 * Wrangler remains the authority for binding names and environment projections.
 * Keeping the full workerd runtime declarations out of the app TypeScript program
 * prevents them from replacing browser DOM types such as Response and Element.
 */
type RateLimit = {
	limit(options: { key: string }): Promise<{ success: boolean }>;
};

type DurableObjectId = { toString(): string };
type DurableObjectNamespace = {
	idFromName(name: string): DurableObjectId;
	get(id: DurableObjectId): {
		fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
	};
};

type FixedLengthStreamInstance = {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;
};

declare const FixedLengthStream: {
	new (length: number): FixedLengthStreamInstance;
};

type R2Object = {
	body: ReadableStream<Uint8Array> | null;
	size: number;
	checksums: {
		sha256?: ArrayBuffer;
		toJSON(): { sha256?: string };
	};
};

type R2Bucket = {
	put(
		key: string,
		value: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView | Blob | string,
		options?: {
			httpMetadata?: { contentType?: string };
			sha256?: ArrayBuffer;
			onlyIf?: { etagDoesNotMatch?: string };
		},
	): Promise<unknown>;
	get(
		key: string,
		options?: { range?: { offset: number; length?: number } },
	): Promise<R2Object | null>;
	delete(key: string): Promise<void>;
};
