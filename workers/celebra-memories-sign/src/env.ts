export type MemoriesSignEnv = Omit<MemoriesSignBindings, 'MEMORIES_STORAGE_TARGET'> & {
	MEMORIES_STORAGE_TARGET: string;
	MEMORIES_R2_ACCOUNT_ID: string;
	MEMORIES_R2_PRESIGN_ACCESS_KEY_ID: string;
	MEMORIES_R2_PRESIGN_SECRET_ACCESS_KEY: string;
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
		env.MEMORIES_R2_ACCOUNT_ID &&
		env.MEMORIES_R2_PRESIGN_ACCESS_KEY_ID &&
		env.MEMORIES_R2_PRESIGN_SECRET_ACCESS_KEY &&
		env.MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY,
	);
}
