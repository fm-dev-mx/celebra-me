/**
 * One-shot helper: split Preview runtime keys from a lane `.env.local`
 * into `.env.preview.local` without printing secret values.
 *
 * Usage: pnpm exec tsx scripts/shared/split-preview-runtime-env.ts <lane-root>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	classifySupabaseUrl,
	parseEnvContent,
	PREVIEW_RUNTIME_SUPABASE_KEYS,
} from './celebra-runtime-env';

const laneRoot = resolve(process.argv[2] || '.');
const localPath = resolve(laneRoot, '.env.local');
const previewPath = resolve(laneRoot, '.env.preview.local');
const examplePath = resolve(laneRoot, '.env.preview.local.example');

if (!existsSync(localPath)) {
	console.error('Missing .env.local in', laneRoot);
	process.exit(1);
}

const local = parseEnvContent(readFileSync(localPath, 'utf8'));
if (classifySupabaseUrl(local.SUPABASE_URL) !== 'preview') {
	console.log('SUPABASE_URL is not Preview; no split performed');
	process.exit(0);
}

const runtimeKeys = [
	...PREVIEW_RUNTIME_SUPABASE_KEYS,
	'PREVIEW_MFA_BYPASS',
	'PREVIEW_ADMIN_EMAILS',
] as const;

const preview = existsSync(previewPath) ? parseEnvContent(readFileSync(previewPath, 'utf8')) : {};

for (const key of runtimeKeys) {
	if (local[key]) preview[key] = local[key];
}
if (local.SUPABASE_URL) preview.PREVIEW_SUPABASE_URL = local.SUPABASE_URL;
if (local.SUPABASE_SERVICE_ROLE_KEY) {
	preview.PREVIEW_SUPABASE_SERVICE_ROLE_KEY = local.SUPABASE_SERVICE_ROLE_KEY;
}

const header = existsSync(examplePath)
	? readFileSync(examplePath, 'utf8')
			.split(/\r?\n/)
			.filter((line) => line.startsWith('#') || line.trim() === '')
			.slice(0, 20)
			.join('\n')
	: '# Preview runtime + operational secrets (gitignored)\n';

const lines = [header, '', '# --- Preview application runtime (dev-preview lane) ---'];
for (const key of runtimeKeys) {
	if (preview[key] != null) lines.push(`${key}=${preview[key]}`);
}
lines.push('', '# --- Preview operational aliases ---');
for (const key of [
	'PREVIEW_DB_URL',
	'PREVIEW_SUPABASE_URL',
	'PREVIEW_SUPABASE_SERVICE_ROLE_KEY',
] as const) {
	if (preview[key] != null) lines.push(`${key}=${preview[key]}`);
}
writeFileSync(previewPath, `${lines.join('\n')}\n`, 'utf8');

const replacements: Record<string, string> = {
	SUPABASE_URL: 'http://127.0.0.1:54321',
	PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
};
const rewritten = readFileSync(localPath, 'utf8')
	.split(/\r?\n/)
	.map((line) => {
		const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
		if (!match) return line;
		const key = match[1]!;
		if (Object.hasOwn(replacements, key)) return `${key}=${replacements[key]}`;
		return line;
	});
writeFileSync(localPath, rewritten.join('\n'), 'utf8');

console.log('split-complete lane=', laneRoot);
console.log('preview_keys=', Object.keys(preview).sort().join(','));
