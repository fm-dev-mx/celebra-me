import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES_IN_PRIORITY = ['.env.local', '.env'];
let fileEnvCache: Record<string, string> | null = null;

function parseEnvFile(content: string): Record<string, string> {
	const parsed: Record<string, string> = {};
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const separatorIndex = trimmed.indexOf('=');
		if (separatorIndex <= 0) continue;

		const key = trimmed.slice(0, separatorIndex).trim();
		let value = trimmed.slice(separatorIndex + 1).trim();
		if (!key) continue;
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		parsed[key] = value;
	}
	return parsed;
}

function loadFileEnvOnce(): Record<string, string> {
	if (fileEnvCache) return fileEnvCache;
	const merged: Record<string, string> = {};
	const cwd = process.cwd();
	for (const fileName of FILES_IN_PRIORITY) {
		const fullPath = resolve(cwd, fileName);
		if (!existsSync(fullPath)) continue;
		try {
			const content = readFileSync(fullPath, 'utf8');
			const parsed = parseEnvFile(content);
			for (const [key, value] of Object.entries(parsed)) {
				// .env.local has priority over .env
				if (merged[key] === undefined) {
					merged[key] = value;
				}
			}
		} catch {
			// Ignore unreadable env files; process.env remains source of truth.
		}
	}
	fileEnvCache = merged;
	return merged;
}

/**
 * Server-safe env reader:
 * 1) process.env (runtime exported vars)
 * 2) .env.local / .env (for local DX when process.env is not hydrated)
 */
export const getEnv = (key: string): string => {
	if (process.env[key]) return process.env[key] as string;
	if (process.env.NODE_ENV === 'test') return '';
	const fileEnv = loadFileEnvOnce();
	return fileEnv[key] ?? '';
};

export const resetEnvCacheForTests = (): void => {
	fileEnvCache = null;
};
