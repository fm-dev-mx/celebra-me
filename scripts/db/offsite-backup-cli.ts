import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { timestamp } from './db-workflow-lib.ts';
import { prepareEncryptedLocalDirectory } from './local-backup-operations.ts';
import {
	copyBackupOffsite,
	decryptWithIdentity,
	downloadOffsiteObject,
	extractOffsiteBundle,
	generateOffsiteKeyPair,
	listOffsiteObjects,
	OFFSITE_ENV,
	OFFSITE_PREFIXES,
	readIdentityFile,
	readOffsiteConfig,
	type OffsiteConfig,
	type OffsitePrefix,
} from './offsite-backup.ts';

const USAGE = `Usage:
  pnpm db:offsite:keygen -- --out=<path outside the repository>
  pnpm db:offsite:upload -- --manifest=<critical manifest.json> [--prefix=test|daily]
  pnpm db:offsite:list [-- --prefix=daily|test]
  pnpm db:offsite:restore -- --identity=<identity file> [--key=<object key> | --prefix=daily|test] [--out=<empty dir>]`;

const [command, ...rest] = process.argv.slice(2).filter((arg) => arg !== '--');
const args = new Map(
	rest.map((arg) => {
		const [name, ...value] = arg.replace(/^--/, '').split('=');
		return [name, value.join('=')] as const;
	}),
);

function prefixArg(fallback: OffsitePrefix): OffsitePrefix {
	const prefix = args.get('prefix') || fallback;
	if (!OFFSITE_PREFIXES.includes(prefix as OffsitePrefix)) {
		throw new Error(`--prefix must be one of: ${OFFSITE_PREFIXES.join(', ')}.`);
	}
	return prefix as OffsitePrefix;
}

function requireConfig(): OffsiteConfig {
	const config = readOffsiteConfig();
	if (!config) {
		throw new Error(
			`Off-site backup is not configured. Set ${Object.values(OFFSITE_ENV).join(', ')} in .env.production.local.`,
		);
	}
	return config;
}

function mebibytes(bytes: number): string {
	return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function keygen(): Promise<void> {
	const out = args.get('out');
	if (!out) throw new Error('Required: --out=<path outside the repository>');
	const path = resolve(out);
	const fromRepo = relative(resolve('.'), path);
	if (!fromRepo.startsWith('..') && !isAbsolute(fromRepo)) {
		throw new Error('Write the private key outside the repository (for example a USB drive).');
	}
	if (existsSync(path)) throw new Error(`Refusing to overwrite an existing file: ${path}`);
	const { identity, recipient } = await generateOffsiteKeyPair();
	writeFileSync(
		path,
		`# Celebra-me off-site backup key, created ${new Date().toISOString()}\n# public key: ${recipient}\n${identity}\n`,
		{ mode: 0o600, flag: 'wx' },
	);
	console.info(
		'Private key written. Store it in your password manager, then remove it from this PC.',
	);
	console.info(`- File: ${path}`);
	console.info(`- Public key for ${OFFSITE_ENV.recipient}: ${recipient}`);
}

async function upload(): Promise<void> {
	const manifest = args.get('manifest');
	if (!manifest) throw new Error('Required: --manifest=<critical manifest.json>');
	const { key, bytes } = await copyBackupOffsite(
		requireConfig(),
		resolve(manifest),
		prefixArg('test'),
	);
	console.info(`Uploaded encrypted copy: ${key} (${mebibytes(bytes)})`);
}

async function list(): Promise<void> {
	const objects = await listOffsiteObjects(requireConfig(), prefixArg('daily'));
	if (objects.length === 0) console.info('No off-site copies found.');
	for (const object of objects) {
		console.info(`${object.key}\t${mebibytes(object.bytes)}\t${object.lastModified}`);
	}
}

async function restore(): Promise<void> {
	const identityPath = args.get('identity');
	if (!identityPath) throw new Error('Required: --identity=<identity file>');
	const identity = readIdentityFile(resolve(identityPath));
	const config = requireConfig();
	let key = args.get('key');
	if (!key) {
		const [latest] = await listOffsiteObjects(config, prefixArg('daily'));
		if (!latest) throw new Error('No off-site copies found to restore.');
		key = latest.key;
	}
	const outputDir = resolve(args.get('out') || `.tmp/offsite-restore/restore-${timestamp()}`);
	console.info(`Downloading ${key}`);
	const encrypted = await downloadOffsiteObject(config, key);
	const bundle = await decryptWithIdentity(encrypted, identity);
	if (process.platform === 'win32') {
		// Decrypted customer data stays encrypted at rest on Windows, like the local backups.
		mkdirSync(outputDir, { recursive: true });
		prepareEncryptedLocalDirectory(outputDir);
	}
	const manifestPath = extractOffsiteBundle(bundle, outputDir);
	console.info('Decrypted and verified the off-site copy.');
	console.info(`- Manifest: ${manifestPath}`);
	console.info('Next (disposable database only, never Production):');
	console.info(
		`  pnpm db:restore:verify-disposable -- --manifest=${manifestPath} --report=${resolve(outputDir, 'restore-report.json')} --storage-root=${resolve(outputDir, 'storage')}`,
	);
}

const commands: Record<string, () => Promise<void>> = { keygen, upload, list, restore };
const run = command ? commands[command] : undefined;
if (!run) {
	console.error(USAGE);
	process.exit(1);
}
try {
	await run();
} catch (error: unknown) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
