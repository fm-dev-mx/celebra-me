export type MemoriesSignEnv = Omit<MemoriesSignBindings, 'MEMORIES_STORAGE_TARGET'> & {
	MEMORIES_STORAGE_TARGET: string;
	MEMORIES_BUCKET: R2Bucket;
	NONCE_GUARD?: DurableObjectNamespace;
	MEMORIES_UPLOAD_CAPABILITY_SECRET: string;
	MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY: string;
};

export type MemoriesSignHandlerOptions = {
	now?: Date;
};

export function getMemoriesRateLimiter(env: MemoriesSignEnv): RateLimit | undefined {
	return env.SIGN_RATE_LIMITER;
}

export function hasRequiredR2Secrets(env: MemoriesSignEnv): boolean {
	return Boolean(
		env.MEMORIES_BUCKET &&
		env.NONCE_GUARD &&
		env.MEMORIES_UPLOAD_CAPABILITY_SECRET &&
		env.MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY,
	);
}
