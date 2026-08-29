/**
 * Narrow runtime shapes shared by the app type-check and Worker tests.
 * Wrangler remains the authority for binding names and environment projections.
 * Keeping the full workerd runtime declarations out of the app TypeScript program
 * prevents them from replacing browser DOM types such as Response and Element.
 */
type RateLimit = {
	limit(options: { key: string }): Promise<{ success: boolean }>;
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
	get(
		key: string,
		options?: { range?: { offset: number; length?: number } },
	): Promise<R2Object | null>;
	delete(key: string): Promise<void>;
};
