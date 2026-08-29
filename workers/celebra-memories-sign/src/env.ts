import {
	VALENTINA_MEMORIES_R2_BUCKET,
	VALENTINA_MEMORIES_RATE_LIMIT,
} from '../../../src/data/valentina-memories-upload.contract';

export type MemoriesRateLimiter = {
	limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type MemoriesSignEnv = {
	R2_ACCOUNT_ID: string;
	R2_ACCESS_KEY_ID: string;
	R2_SECRET_ACCESS_KEY: string;
	R2_BUCKET: string;
	MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY: string;
	[VALENTINA_MEMORIES_RATE_LIMIT.bindingName]: MemoriesRateLimiter;
};

export type MemoriesSignHandlerOptions = {
	now?: Date;
};

const RATE_LIMIT_BINDING = VALENTINA_MEMORIES_RATE_LIMIT.bindingName;

export function getMemoriesRateLimiter(env: MemoriesSignEnv): MemoriesRateLimiter | undefined {
	return env[RATE_LIMIT_BINDING];
}

export function hasRequiredR2Secrets(env: MemoriesSignEnv): boolean {
	return Boolean(
		env.R2_ACCOUNT_ID &&
		env.R2_ACCESS_KEY_ID &&
		env.R2_SECRET_ACCESS_KEY &&
		env.R2_BUCKET === VALENTINA_MEMORIES_R2_BUCKET &&
		env.MEMORIES_UPLOAD_REQUEST_VERIFY_PUBLIC_KEY,
	);
}
