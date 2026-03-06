#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'events');
const EVENT_TYPES = new Set(['xv', 'boda', 'bautizo', 'cumple']);

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

function normalizeEvent(row) {
	return {
		eventType: String(row.event_type || '').trim(),
		slug: String(row.slug || '').trim(),
		status: String(row.status || '').trim(),
	};
}

function entryKey(eventType, slug) {
	return `${eventType}:${slug}`;
}

async function fetchDbEvents(supabaseUrl, serviceRoleKey) {
	const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/events?select=slug,event_type,status`;
	const response = await fetch(endpoint, {
		headers: {
			apikey: serviceRoleKey,
			Authorization: `Bearer ${serviceRoleKey}`,
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`[DB] Supabase request failed (${response.status}): ${body}`);
	}

	const rows = await response.json();
	if (!Array.isArray(rows)) {
		throw new Error('[DB] Unexpected response format while reading events.');
	}

	return rows.map(normalizeEvent).filter((row) => row.slug && row.eventType);
}

function loadContentEvents({ includeDemos, includeTemplates, slugFilter, eventTypeFilter }) {
	if (!fs.existsSync(CONTENT_DIR)) {
		throw new Error(`[Content] Missing events directory: ${CONTENT_DIR}`);
	}

	const files = fs.readdirSync(CONTENT_DIR).filter((file) => file.endsWith('.json'));
	const events = [];
	const warnings = [];

	for (const file of files) {
		const slug = file.replace(/\.json$/, '');
		if (!includeTemplates && slug.startsWith('template-')) continue;
		if (slugFilter && slug !== slugFilter) continue;

		const fullPath = path.join(CONTENT_DIR, file);
		let parsed;
		try {
			parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
		} catch (error) {
			throw new Error(
				`[Content] Invalid JSON in ${file}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		const eventType = String(parsed.eventType || '').trim();
		if (!EVENT_TYPES.has(eventType)) {
			warnings.push(`[Content] ${file} has unsupported eventType "${eventType}".`);
			continue;
		}

		if (!includeDemos && parsed.isDemo === true) continue;
		if (eventTypeFilter && eventType !== eventTypeFilter) continue;

		events.push({
			eventType,
			slug,
			file,
			isDemo: parsed.isDemo === true,
		});
	}

	return { events, warnings };
}

function printMismatch(title, rows) {
	if (rows.length === 0) {
		console.log(`- ${title}: 0`);
		return;
	}

	console.log(`- ${title}: ${rows.length}`);
	for (const row of rows) {
		console.log(
			`  • ${row.eventType}/${row.slug}${row.file ? ` (content: ${row.file})` : ''}${row.status ? ` [${row.status}]` : ''}`,
		);
	}
}

async function main() {
	const { values } = parseArgs({
		options: {
			help: { type: 'boolean', short: 'h' },
			includeDemos: { type: 'boolean', default: false },
			includeTemplates: { type: 'boolean', default: false },
			allowMissingDb: { type: 'boolean', default: false },
			slug: { type: 'string' },
			eventType: { type: 'string' },
		},
		strict: false,
	});

	if (values.help) {
		console.log(`
Validate parity between content event files and DB events.

Usage:
  pnpm ops validate-event-parity [options]

Options:
  --slug <slug>             Validate only one slug
  --eventType <type>        Filter by event type (xv, boda, bautizo, cumple)
  --includeDemos            Include content files with isDemo=true
  --includeTemplates        Include template-* content files
  --allowMissingDb          Exit 0 when Supabase env vars are missing
  --help, -h                Show this help
`);
		return;
	}

	if (values.eventType && !EVENT_TYPES.has(values.eventType)) {
		throw new Error(
			`Invalid --eventType "${values.eventType}". Allowed: xv, boda, bautizo, cumple.`,
		);
	}

	loadEnvFile('.env.local');
	loadEnvFile('.env');

	const supabaseUrl = process.env.SUPABASE_URL || '';
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

	const { events: contentEvents, warnings } = loadContentEvents({
		includeDemos: values.includeDemos,
		includeTemplates: values.includeTemplates,
		slugFilter: values.slug,
		eventTypeFilter: values.eventType,
	});

	warnings.forEach((warning) => console.warn(warning));

	if (!supabaseUrl || !serviceRoleKey) {
		const message =
			'[DB] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to validate DB parity.';
		if (values.allowMissingDb) {
			console.warn(`${message} Skipping DB comparison due to --allowMissingDb.`);
			return;
		}
		throw new Error(message);
	}

	const dbEvents = await fetchDbEvents(supabaseUrl, serviceRoleKey);
	const filteredDbEvents = dbEvents.filter((event) => {
		if (values.slug && event.slug !== values.slug) return false;
		if (values.eventType && event.eventType !== values.eventType) return false;
		return true;
	});

	const contentMap = new Map(
		contentEvents.map((event) => [entryKey(event.eventType, event.slug), event]),
	);
	const dbMap = new Map(
		filteredDbEvents.map((event) => [entryKey(event.eventType, event.slug), event]),
	);

	const missingInContent = filteredDbEvents.filter(
		(event) => !contentMap.has(entryKey(event.eventType, event.slug)),
	);
	const missingInDb = contentEvents.filter(
		(event) => !dbMap.has(entryKey(event.eventType, event.slug)),
	);

	console.log('Event parity report');
	console.log('===================');
	console.log(`Content events considered: ${contentEvents.length}`);
	console.log(`DB events considered: ${filteredDbEvents.length}`);

	printMismatch('Missing content for DB event', missingInContent);
	printMismatch('Missing DB event for content', missingInDb);

	if (missingInContent.length > 0 || missingInDb.length > 0) {
		process.exitCode = 1;
		return;
	}

	console.log('Parity validation passed.');
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
