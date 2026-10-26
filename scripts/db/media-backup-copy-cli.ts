import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { timestamp } from './db-workflow-lib.ts';
import { prepareEncryptedLocalDirectory } from './local-backup-operations.ts';
import {
	drillMediaRestore,
	MEDIA_COPY_ENV,
	readMediaCopyConfig,
	runMediaCopy,
	targetLocation,
	type MediaCopyConfig,
} from './media-backup-copy.ts';
import { listR2Objects } from './offsite-backup.ts';

const USAGE = `Usage:
  pnpm db:media-copy:run [-- --dry-run]
  pnpm db:media-copy:restore [-- --key=<backup object key>] [--out=<file>]`;

const [command, ...rest] = process.argv.slice(2).filter((arg) => arg !== '--');
const args = new Map(
	rest.map((arg) => {
		const [name, ...value] = arg.replace(/^--/, '').split('=');
		return [name, value.join('=')] as const;
	}),
);

function requireConfig(): MediaCopyConfig {
	const config = readMediaCopyConfig();
	if (!config) {
		throw new Error(
			`Media copy is not configured. Set ${Object.values(MEDIA_COPY_ENV).join(', ')} in .env.production.local.`,
		);
	}
	return config;
}

async function run(): Promise<void> {
	const result = await runMediaCopy(requireConfig(), {
		dryRun: args.has('dry-run'),
		log: (line) => console.info(line),
	});
	console.info(
		`${args.has('dry-run') ? 'Would copy' : 'Copied'} ${result.copied} originals (${result.bytes} bytes); ${result.alreadyPresent} already in the backup.`,
	);
}

async function restore(): Promise<void> {
	const config = requireConfig();
	let key = args.get('key');
	if (!key) {
		// Drill default: the newest invitation original, whose key also carries its sha256.
		const [newest] = (await listR2Objects(targetLocation(config), 'invitation-media/'))
			.filter((object) => /-[a-f0-9]{64}\.[a-z0-9]+$/u.test(object.key))
			.sort((left, right) => right.lastModified.localeCompare(left.lastModified));
		if (!newest) throw new Error('The backup bucket has no invitation originals yet.');
		key = newest.key;
	}
	const drill = await drillMediaRestore(config, key);
	const out = resolve(
		args.get('out') || `.tmp/media-restore/restore-${timestamp()}/${key.split('/').pop()}`,
	);
	mkdirSync(dirname(out), { recursive: true });
	if (process.platform === 'win32') prepareEncryptedLocalDirectory(dirname(out));
	writeFileSync(out, drill.body, { mode: 0o600, flag: 'wx' });
	console.info(`Restore drill passed: ${key} (${drill.bytes} bytes, sha256 ${drill.sha256})`);
	console.info(
		`- expected sha256: ${drill.digestMatches === null ? 'none recorded' : 'matches'}`,
	);
	console.info(
		`- Production original: ${drill.matchesSource === null ? 'gone (backup is the only copy)' : 'identical'}`,
	);
	console.info(`- File: ${out}`);
}

const commands: Record<string, () => Promise<void>> = { run, restore };
const selected = command ? commands[command] : undefined;
if (!selected) {
	console.error(USAGE);
	process.exit(1);
}
try {
	await selected();
} catch (error: unknown) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
