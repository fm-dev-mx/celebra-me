/**
 * content-parity-cli.ts — Read-only cross-environment semantic content parity.
 *
 * Usage:
 *   pnpm invitation:content-parity -- --slug <slug> --event-type <type> [--envs local,preview,production]
 *
 * This command never mutates any database. Credential presence and runtime target do not
 * authorize Preview/Production writes.
 */

import {
	compareAcrossEnvironments,
	listSemanticDifferencePaths,
	type ContentParityEnvironment,
	type SemanticInvitationSnapshot,
} from './content-parity.ts';
import {
	loadSemanticParitySnapshot as loadSnapshot,
	type LoadedSnapshot,
} from './content-parity-load.ts';

interface CliOptions {
	slug: string;
	eventType: string;
	envs: ContentParityEnvironment[];
	paths: boolean;
	assetInventory: boolean;
}

function parseArgs(argv: string[]): CliOptions {
	let slug = '';
	let eventType = '';
	let envs: ContentParityEnvironment[] = ['local', 'preview', 'production'];
	let paths = false;
	let assetInventory = false;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--slug') slug = String(argv[++i] || '').trim();
		else if (arg === '--event-type') eventType = String(argv[++i] || '').trim();
		else if (arg === '--envs' || arg.startsWith('--envs=')) {
			const envArgument =
				arg === '--envs' ? String(argv[++i] || '') : arg.slice('--envs='.length);
			envs = envArgument
				.split(/[\s,]+/)
				.map((part) => part.trim())
				.filter(Boolean) as ContentParityEnvironment[];
		} else if (arg === '--paths') {
			paths = true;
		} else if (arg === '--asset-inventory') {
			assetInventory = true;
		} else if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		}
	}

	if (!slug || !eventType) {
		printHelp();
		process.exit(1);
	}

	const allowed: ContentParityEnvironment[] = ['local', 'preview', 'production'];
	for (const env of envs) {
		if (!allowed.includes(env)) {
			console.error(`Unknown environment "${env}". Allowed: ${allowed.join(', ')}`);
			process.exit(1);
		}
	}
	if (envs.length < 2) {
		console.error('Provide at least two environments via --envs.');
		process.exit(1);
	}

	return { slug, eventType, envs, paths, assetInventory };
}

function printHelp(): void {
	console.info(`Read-only semantic invitation content parity.

Usage:
  pnpm invitation:content-parity -- --slug <slug> --event-type <type> [--envs local,preview,production] [--paths] [--asset-inventory]

Compares invitation-facing semantic state only. Never reads or compares guests, claims,
Auth, intake, analytics, or commercial tables. Never mutates any target.
Use --paths to list normalized semantic locations only; it never prints field values, IDs, URLs, or hashes.
Use --asset-inventory to list current asset candidates with normalized metadata and content-reference paths only.

See docs/core/content-parity-rsvp-isolation.md.`);
}

function main(): void {
	const options = parseArgs(process.argv.slice(2));
	console.info('Content parity check (read-only; no mutations authorized by this command)');
	console.info(`Slug: ${options.slug}  Event type: ${options.eventType}`);
	console.info(`Environments: ${options.envs.join(', ')}`);

	const snapshots: Partial<Record<ContentParityEnvironment, SemanticInvitationSnapshot>> = {};
	const inventories: Partial<Record<ContentParityEnvironment, LoadedSnapshot>> = {};
	for (const env of options.envs) {
		const loadedSnapshot = loadSnapshot(
			env,
			options.slug,
			options.eventType,
			options.assetInventory,
		);
		if (loadedSnapshot) {
			snapshots[env] = loadedSnapshot.snapshot;
			inventories[env] = loadedSnapshot;
		}
	}

	const loaded = Object.keys(snapshots);
	if (loaded.length < 2) {
		console.error(
			`Need at least two loaded environments to compare; loaded: ${loaded.join(', ') || '(none)'}`,
		);
		process.exit(1);
	}

	if (options.assetInventory) {
		for (const environment of options.envs) {
			const inventory = inventories[environment];
			if (!inventory) continue;
			const safeRows = inventory.assets.map((asset) => ({
				semanticKey: asset.managedSourceKey,
				displayName: asset.displayName,
				mimeType: asset.mimeType,
				width: asset.width,
				height: asset.height,
				fileSize: asset.fileSize,
				referencedBy: inventory.referencedAssetPaths.get(asset.id) ?? [],
			}));
			console.info(`[${environment}] asset inventory: ${JSON.stringify(safeRows)}`);
		}
	}

	const result = compareAcrossEnvironments(options.slug, options.eventType, snapshots);
	if (result.ok) {
		console.info(`PASS: semantic parity across ${result.environments.join(', ')}`);
		process.exit(0);
	}

	console.error(`FAIL: ${result.drifts.length} semantic drift(s)`);
	for (const drift of result.drifts) {
		const paths =
			options.paths &&
			(drift.entity === 'invitation_content_drafts' ||
				drift.entity === 'published_invitation_content') &&
			drift.field === 'content'
				? listSemanticDifferencePaths(drift.left, drift.right)
				: [];
		console.error(
			`- [${drift.environments.join(' vs ')}] ${drift.entity}.${drift.field}: ${drift.detail}${
				paths.length > 0 ? ` (paths: ${paths.join(', ')})` : ''
			}`,
		);
	}
	process.exit(1);
}

main();
