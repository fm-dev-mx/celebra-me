#!/usr/bin/env node
/**
 * Secret scan for versioned files.
 *
 * Reads every file from `git ls-files` and fails when one holds what looks like a real credential:
 * a long JWT (Supabase anon and service_role keys), a service_role key assignment, a Cloudflare,
 * GitHub or Stripe token, or a PRIVATE KEY block. It also fails when a `.env*` file other than a
 * `.env*.example` template is versioned. `.env*`, `.secrets/`, `.vercel/` and `.backups/` are never
 * read. The guard fails closed: a Git error or an empty file list is an error, not a pass.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const RULES = [
	{
		id: 'jwt',
		label: 'long JWT (Supabase anon or service_role key)',
		pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/,
	},
	{
		id: 'service-role-key',
		label: 'service_role key assignment',
		pattern: /service_?role_?key["']?\s*[:=]\s*["'`][A-Za-z0-9._-]{30,}["'`]/i,
	},
	{
		id: 'supabase-secret-key',
		label: 'Supabase secret key',
		pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}/,
	},
	{
		id: 'cloudflare-token',
		label: 'Cloudflare API token or key assignment',
		pattern: /\b(?:CLOUDFLARE|CF)_API_(?:TOKEN|KEY)["']?\s*[:=]\s*["'`]?[A-Za-z0-9_-]{37,}/,
	},
	{
		id: 'github-token',
		label: 'GitHub token',
		pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})/,
	},
	{
		id: 'stripe-key',
		label: 'Stripe secret key or webhook secret',
		pattern: /\b(?:(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{24,})/,
	},
	{
		id: 'private-key',
		label: 'PRIVATE KEY block',
		pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/,
	},
];

// Supabase's public demo JWTs for the local stack; only the `jwt` rule is waived here.
const ALLOWED = new Map([
	['scripts/db/disposable-test-env.ts', new Set(['jwt'])],
	['tests/db/public-rsvp-http-wiring-db.test.ts', new Set(['jwt'])],
]);

const UNREAD_DIRECTORIES = ['.secrets/', '.vercel/', '.backups/'];

const isEnvFile = (repoFile) => path.posix.basename(repoFile).startsWith('.env');
const isEnvTemplate = (repoFile) => isEnvFile(repoFile) && repoFile.endsWith('.example');
const isUnread = (repoFile) =>
	isEnvFile(repoFile) ||
	UNREAD_DIRECTORIES.some((dir) => repoFile.startsWith(dir) || repoFile.includes(`/${dir}`));

const errors = [];
let files = [];
try {
	files = execFileSync('git', ['ls-files', '-z'], { cwd: PROJECT_ROOT, encoding: 'utf8' })
		.split('\0')
		.filter(Boolean);
} catch (error) {
	errors.push(`git ls-files failed (${error.message}); the scan must not pass unchecked.`);
}
if (errors.length === 0 && files.length === 0) {
	errors.push('git ls-files returned no files; the scan must not pass unchecked.');
}

let scannedFiles = 0;
for (const repoFile of files) {
	if (isEnvFile(repoFile) && !isEnvTemplate(repoFile)) {
		errors.push(
			`${repoFile} is a versioned env file. Only .env*.example templates belong in Git; ` +
				`remove it with git rm --cached and rotate every value it held.`,
		);
	}
	if (isUnread(repoFile)) continue;

	const absolute = path.join(PROJECT_ROOT, repoFile);
	// A deleted but still indexed file, or a submodule entry, has nothing to read.
	if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
	const buffer = fs.readFileSync(absolute);
	if (buffer.includes(0)) continue; // binary file
	scannedFiles++;

	const allowed = ALLOWED.get(repoFile) ?? new Set();
	const lines = buffer.toString('utf8').split(/\r?\n/);
	for (const rule of RULES) {
		if (allowed.has(rule.id)) continue;
		const lineIndex = lines.findIndex((line) => rule.pattern.test(line));
		if (lineIndex !== -1) {
			errors.push(
				`${repoFile}:${lineIndex + 1} holds a ${rule.label}. Move it to an env file or a ` +
					`secret store and rotate it; never paste the value here.`,
			);
		}
	}
}

if (errors.length > 0) {
	for (const error of errors) console.error(`[secrets] ${error}`);
	process.exit(1);
}

console.log(`Secret scan: checked ${scannedFiles} versioned files; no credentials found.`);
