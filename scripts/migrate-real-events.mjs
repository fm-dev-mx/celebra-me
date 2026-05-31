#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_EVENTS_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'events');

function loadEnvFile(relativePath) {
	const envPath = path.join(PROJECT_ROOT, relativePath);
	if (!fs.existsSync(envPath)) return;
	const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const index = line.indexOf('=');
		if (index === -1) continue;
		const key = line.slice(0, index).trim();
		let value = line.slice(index + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function log(...args) {
	console.log('[migrate]', ...args);
}
function warn(...args) {
	console.warn('[migrate] WARN:', ...args);
}
function error(...args) {
	console.error('[migrate] ERROR:', ...args);
}

async function supabaseQuery(pathWithQuery, options = {}) {
	const endpoint = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${pathWithQuery}`;
	const { method = 'GET', body, prefer } = options;

	const headers = {
		apikey: SERVICE_ROLE_KEY,
		Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
		Accept: 'application/json',
		'Content-Type': 'application/json',
	};
	if (prefer) headers['Prefer'] = prefer;

	const response = await fetch(endpoint, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Supabase request failed (${response.status}): ${text}`);
	}

	const text = await response.text();
	return text ? JSON.parse(text) : null;
}

async function getProjectSnapshot(projectId) {
	const rows = await supabaseQuery(
		`invitations?select=snapshot,title,event_type&id=eq.${encodeURIComponent(projectId)}&limit=1`,
	);
	if (!rows || !rows[0]) return null;
	return rows[0];
}

const EVENT_MAP = [
	{
		file: 'ana-sofia-cota-guillen.json',
		projectId: '40ef6637-4227-4c79-b377-a7726530d82f',
		slug: 'ana-sofia-cota-guillen',
		eventType: 'xv',
	},
	{
		file: 'cesar-ramses.json',
		projectId: 'fae40d35-aca4-4d47-86be-d0aa6ed36b3a',
		slug: 'cesar-ramses',
		eventType: 'bautizo',
	},
	{
		file: 'gerardo-sesenta.json',
		projectId: '8a0931e8-556c-474f-9ddd-345a59ff5461',
		slug: 'gerardo-sesenta',
		eventType: 'cumple',
	},
	{
		file: 'ximena-meza-trasvina.json',
		projectId: '4c62d0fd-0e7b-4fe8-8e4a-55cf44f136a8',
		slug: 'ximena-meza-trasvina',
		eventType: 'xv',
	},
];

async function migrateEvent(event, isDryRun) {
	const fullPath = path.join(CONTENT_EVENTS_DIR, event.file);
	if (!fs.existsSync(fullPath)) {
		warn(`File not found: ${event.file} — already migrated? Skipping.`);
		return;
	}

	const rawContent = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
	log(`\n=== ${event.eventType}/${event.slug} ===`);

	const project = await getProjectSnapshot(event.projectId);
	if (!project) {
		error(`Project ${event.projectId} not found. Cannot determine _assetSlug. Skip.`);
		return;
	}

	const snapshot = project.snapshot;
	const previewSlug = snapshot?.previewSlug;
	if (!previewSlug) {
		warn(`Project ${event.projectId} has no previewSlug in snapshot. Using slug as fallback.`);
	}

	const assetSlug = previewSlug || event.slug;
	const publishedContent = { ...rawContent, _assetSlug: assetSlug };

	log(`Project: "${project.title}" (${event.projectId})`);
	log(`Asset slug: ${assetSlug}`);

	if (isDryRun) {
		log(`[DRY RUN] Would upsert published_invitation_content:`);
		log(`  - slug: ${event.slug}`);
		log(`  - event_type: ${event.eventType}`);
		log(`  - invitation_project_id: ${event.projectId}`);
		log(`  - is_demo: false`);
		log(`  - content keys: ${Object.keys(publishedContent).join(', ')}`);
		log(`  - would then DELETE ${event.file}`);
		return;
	}

	// Upsert published_invitation_content
	try {
		const existing = await supabaseQuery(
			`published_invitation_content?select=id,version&invitation_project_id=eq.${encodeURIComponent(event.projectId)}&limit=1`,
		);

		if (existing && existing[0]) {
			const currentVersion = existing[0].version || 0;
			log(
				`Updating existing published content row: ${existing[0].id} (v${currentVersion} → v${currentVersion + 1})`,
			);
			const existingRow = await supabaseQuery(
				`published_invitation_content?id=eq.${encodeURIComponent(existing[0].id)}&select=id,slug,event_type,version`,
				{
					method: 'PATCH',
					prefer: 'return=representation',
					body: {
						content: publishedContent,
						slug: event.slug,
						version: currentVersion + 1,
						published_at: new Date().toISOString(),
					},
				},
			);
			log(`Updated: ${existingRow?.[0]?.id} (version ${existingRow?.[0]?.version})`);
		} else {
			const newRow = await supabaseQuery(
				`published_invitation_content?select=id,slug,event_type,version`,
				{
					method: 'POST',
					prefer: 'return=representation',
					body: {
						invitation_project_id: event.projectId,
						slug: event.slug,
						event_type: event.eventType,
						is_demo: false,
						content: publishedContent,
						version: 1,
						published_at: new Date().toISOString(),
					},
				},
			);
			log(`Created: ${newRow?.[0]?.id} (version ${newRow?.[0]?.version})`);
		}
	} catch (err) {
		error(`Failed to upsert published content for ${event.slug}: ${err.message}`);
		process.exitCode = 1;
		return;
	}

	// Remove static JSON file after successful upsert
	try {
		fs.unlinkSync(fullPath);
		log(`DELETED: ${event.file}`);
	} catch (err) {
		error(`Failed to delete ${event.file}: ${err.message}`);
		process.exitCode = 1;
	}
}

async function main() {
	const args = process.argv.slice(2);
	const isDryRun = !args.includes('--apply');

	log(`=== Real Event Migration ===`);
	log(`Mode: ${isDryRun ? 'DRY RUN (read-only, no changes)' : 'APPLY'}`);
	log('');

	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
		error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
		process.exit(1);
	}

	for (const event of EVENT_MAP) {
		await migrateEvent(event, isDryRun);
	}

	log('\n=== Migration Summary ===');
	if (isDryRun) {
		log('Dry run complete. No changes were made.');
		log('Run with --apply to execute the migration:');
		log('  node scripts/migrate-real-events.mjs --apply');
	} else {
		log('Migration complete.');
		log('Run verification: pnpm type-check && pnpm lint && pnpm test && pnpm build');
		log('Then verify public routes render correctly.');
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
