/**
 * replicate-storage-binaries.ts — Replicate Storage assets from production to local Supabase
 *
 * Queries the list of objects in the 'invitation-assets' bucket on production,
 * downloads each binary from the public CDN, and uploads it to the local Supabase
 * Storage service via its API.
 *
 * Usage:
 *   tsx scripts/db/replicate-storage-binaries.ts [--target local|disposable]
 */

import { getProdDbUrl, parseDbUrl, runPsql, parseTsv } from './db-workflow-lib.ts';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Get Supabase keys dynamically from status if available, fallback to .env
function getSupabaseKeys(): { url: string; key: string } {
	const result = spawnSync('supabase', ['status', '-o', 'json'], {
		cwd: process.cwd(),
		encoding: 'utf8',
		shell: process.platform === 'win32',
	});

	if (result.status === 0) {
		try {
			const stdout = result.stdout;
			const jsonLine = stdout.split('\n').find(l => l.trim().startsWith('{'));
			if (jsonLine) {
				const data = JSON.parse(jsonLine);
				if (data.API_URL && data.SERVICE_ROLE_KEY) {
					return { url: data.API_URL, key: data.SERVICE_ROLE_KEY };
				}
			}
		} catch (e) {
			console.warn('Failed to parse supabase status JSON, falling back to .env:', e);
		}
	}
	return loadLocalSecrets();
}

// Load local secrets from .env
function loadLocalSecrets(): { url: string; key: string } {
	const envPath = resolve(process.cwd(), '.env');
	if (!existsSync(envPath)) {
		throw new Error('Local .env file not found.');
	}
	const content = readFileSync(envPath, 'utf-8');
	let url = 'http://127.0.0.1:54321';
	let key = '';

	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eqIdx = trimmed.indexOf('=');
		if (eqIdx === -1) continue;
		const k = trimmed.slice(0, eqIdx).trim();
		const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
		if (k === 'SUPABASE_URL') url = v;
		if (k === 'SUPABASE_SERVICE_ROLE_KEY') key = v;
	}

	return { url, key };
}

async function main() {
	const args = process.argv.slice(2);
	const targetIdx = args.indexOf('--target');
	const targetEnv = targetIdx !== -1 ? args[targetIdx + 1] : 'local';

	let localApiUrl: string;
	const localSecrets = getSupabaseKeys();
	const localServiceKey = localSecrets.key;

	if (targetEnv === 'disposable') {
		// Disposable environment runs on port 54331 for API
		localApiUrl = 'http://127.0.0.1:54331';
		// In disposable container, service_role key is same as default local
		console.info(`Targeting disposable test environment on ${localApiUrl}`);
	} else {
		localApiUrl = localSecrets.url;
		console.info(`Targeting persistent local environment on ${localApiUrl}`);
	}

	// 1. Get production details
	const { url: prodDbUrl } = getProdDbUrl();
	const parsed = parseDbUrl(prodDbUrl);

	// Extract project ref from username
	const projectRef = parsed.username.split('.')[1] || parsed.hostname.split('.')[0];
	if (!projectRef) {
		throw new Error(`Could not extract Supabase project reference from: ${parsed.username} or ${parsed.hostname}`);
	}

	const prodCdnBase = `https://${projectRef}.supabase.co/storage/v1/object/public/invitation-assets`;
	console.info(`Production Project Ref: ${projectRef}`);
	console.info(`Production CDN Base:   ${prodCdnBase}`);

	// 2. Query production storage.objects for invitation-assets
	console.info('\nQuerying production storage.objects list...');
	const querySql = `
		select name, metadata->>'mimetype' as mime
		from storage.objects
		where bucket_id = 'invitation-assets'
		order by name;
	`;
	
	const psqlResult = runPsql(querySql, prodDbUrl);
	const rows = parseTsv(psqlResult.stdout);
	
	const objects = rows
		.filter((r) => r.length >= 2 && r[0])
		.map((r) => ({
			name: r[0]!,
			mime: r[1] || 'image/webp',
		}));

	console.info(`Found ${objects.length} assets to replicate.`);
	if (objects.length === 0) {
		console.info('No assets found. Replication complete.');
		return;
	}

	// 3. Replicate each asset
	let successCount = 0;
	let failCount = 0;

	for (let i = 0; i < objects.length; i++) {
		const obj = objects[i]!;
		const progress = `[${i + 1}/${objects.length}]`;
		const downloadUrl = `${prodCdnBase}/${obj.name}`;
		const uploadUrl = `${localApiUrl}/storage/v1/object/invitation-assets/${obj.name}`;

		console.log(`${progress} Replicating "${obj.name}" (${obj.mime})...`);

		try {
			// Download
			const dlRes = await fetch(downloadUrl);
			if (!dlRes.ok) {
				throw new Error(`Download failed with status ${dlRes.status} (${dlRes.statusText})`);
			}
			const buffer = await dlRes.arrayBuffer();

			// Upload
			const ulRes = await fetch(uploadUrl, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${localServiceKey}`,
					'Content-Type': obj.mime,
					'x-upsert': 'true',
				},
				body: buffer,
			});

			if (!ulRes.ok) {
				const errorText = await ulRes.text();
				throw new Error(`Upload failed with status ${ulRes.status}: ${errorText}`);
			}

			console.log(`  └─ OK`);
			successCount++;
		} catch (err) {
			console.error(`  └─ ❌ FAILED: ${err instanceof Error ? err.message : String(err)}`);
			failCount++;
		}
	}

	console.info('\n============================================================');
	console.info('Storage Binary Replication Complete.');
	console.info(`Success: ${successCount}`);
	console.log(`Failed:  ${failCount}`);
	console.info('============================================================');

	if (failCount > 0) {
		process.exit(1);
	} else {
		process.exit(0);
	}
}

main().catch((err) => {
	console.error('Fatal replication error:', err instanceof Error ? err.message : String(err));
	process.exit(1);
});
