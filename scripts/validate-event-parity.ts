#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parseEnvContent, PROJECT_ROOT } from './db/db-workflow-lib.ts';

const CONTENT_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'events');
const ROUTABLE_CONTENT_DIRS = [
	path.join(PROJECT_ROOT, 'src', 'content', 'events'),
	path.join(PROJECT_ROOT, 'src', 'content', 'event-demos'),
];
const EVENT_TYPES = new Set(['xv', 'boda', 'bautizo', 'cumple']);

interface ContentEvent {
	eventType: string;
	slug: string;
	file: string;
	isDemo: boolean;
}

interface DbEvent {
	eventType: string;
	slug: string;
	status: string;
}

interface SlugConflict {
	slug: string;
	first: string;
	second: string;
}

function isPlaceholderEnvValue(value: string | undefined): boolean {
	const normalized = String(value || '')
		.trim()
		.toLowerCase();
	return (
		normalized === '' ||
		normalized.includes('your-supabase-url') ||
		normalized.includes('your-supabase-service-role-key') ||
		normalized.includes('changeme')
	);
}

async function fetchPublishedContentSlugs(
	supabaseUrl: string,
	serviceRoleKey: string,
): Promise<string[]> {
	const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/published_invitation_content?select=slug,event_type`;
	const response = await fetch(endpoint, {
		headers: {
			apikey: serviceRoleKey,
			Authorization: `Bearer ${serviceRoleKey}`,
			Accept: 'application/json',
		},
	});
	if (!response.ok) {
		throw new Error(`[DB] Failed to fetch published_invitation_content (${response.status})`);
	}
	const rows = (await response.json()) as Array<{ event_type?: string; slug?: string }>;
	if (!Array.isArray(rows)) return [];
	return rows
		.map((r) => entryKey(String(r.event_type || '').trim(), String(r.slug || '').trim()))
		.filter(Boolean);
}

function loadEnvFile(relativePath: string): void {
	const envPath = path.join(PROJECT_ROOT, relativePath);
	if (!existsSync(envPath)) return;

	const parsed = parseEnvContent(readFileSync(envPath, 'utf8'));
	for (const [key, value] of Object.entries(parsed)) {
		if (process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

function normalizeEvent(row: Record<string, unknown>): DbEvent {
	return {
		eventType: String(row.event_type || '').trim(),
		slug: String(row.slug || '').trim(),
		status: String(row.status || '').trim(),
	};
}

function entryKey(eventType: string, slug: string): string {
	return `${eventType}:${slug}`;
}

function collectRoutableSlugConflicts(): SlugConflict[] {
	const slugOwners = new Map<string, string>();
	const conflicts: SlugConflict[] = [];

	for (const dir of ROUTABLE_CONTENT_DIRS) {
		if (!existsSync(dir)) continue;

		const files = readdirSync(dir, { recursive: true }).filter(
			(file): file is string => typeof file === 'string' && file.endsWith('.json'),
		);

		for (const file of files) {
			const fullPath = path.join(dir, file);
			const parsed = JSON.parse(readFileSync(fullPath, 'utf8')) as Record<string, unknown>;
			const slug = path.basename(file, '.json');
			const eventType = String(parsed.eventType || '').trim();
			const owner = `${eventType}:${path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/')}`;

			const existing = slugOwners.get(slug);
			if (existing && existing !== owner) {
				conflicts.push({ slug, first: existing, second: owner });
				continue;
			}

			slugOwners.set(slug, owner);
		}
	}

	return conflicts;
}

async function fetchDbEvents(supabaseUrl: string, serviceRoleKey: string): Promise<DbEvent[]> {
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

	const rows = (await response.json()) as Array<Record<string, unknown>>;
	if (!Array.isArray(rows)) {
		throw new Error('[DB] Unexpected response format while reading events.');
	}

	return rows.map(normalizeEvent).filter((row) => row.slug && row.eventType);
}

interface LoadContentEventsOptions {
	includeDemos: boolean;
	includeTemplates: boolean;
	slugFilter?: string;
	eventTypeFilter?: string;
}

function loadContentEvents({
	includeDemos,
	includeTemplates,
	slugFilter,
	eventTypeFilter,
}: LoadContentEventsOptions): { events: ContentEvent[]; warnings: string[] } {
	if (!existsSync(CONTENT_DIR)) {
		throw new Error(`[Content] Missing events directory: ${CONTENT_DIR}`);
	}

	const files = readdirSync(CONTENT_DIR).filter((file) => file.endsWith('.json'));
	const events: ContentEvent[] = [];
	const warnings: string[] = [];

	for (const file of files) {
		const slug = file.replace(/\.json$/, '');
		if (!includeTemplates && slug.startsWith('template-')) continue;
		if (slugFilter && slug !== slugFilter) continue;

		const fullPath = path.join(CONTENT_DIR, file);
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(readFileSync(fullPath, 'utf8'));
		} catch (error) {
			throw new Error(
				`[Content] Invalid JSON in ${file}: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error },
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

interface MismatchRow {
	eventType: string;
	slug: string;
	file?: string;
	status?: string;
}

function printMismatch(title: string, rows: MismatchRow[]): void {
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

async function main(): Promise<void> {
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

	const slugConflicts = collectRoutableSlugConflicts();
	if (slugConflicts.length > 0) {
		console.error('[Content] Duplicate routable slugs detected across public collections.');
		for (const conflict of slugConflicts) {
			console.error(`  • ${conflict.slug}: ${conflict.first} <-> ${conflict.second}`);
		}
		process.exit(1);
	}

	const supabaseUrl = process.env.SUPABASE_URL || '';
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

	const { events: contentEvents, warnings } = loadContentEvents({
		includeDemos: values.includeDemos ?? false,
		includeTemplates: values.includeTemplates ?? false,
		slugFilter: values.slug,
		eventTypeFilter: values.eventType,
	});

	warnings.forEach((warning) => console.warn(warning));

	if (isPlaceholderEnvValue(supabaseUrl) || isPlaceholderEnvValue(serviceRoleKey)) {
		const message =
			'[DB] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to validate DB parity.';
		if (values.allowMissingDb) {
			console.warn(`${message} Skipping DB comparison due to --allowMissingDb.`);
			return;
		}
		throw new Error(message);
	}

	let dbEvents: DbEvent[];
	let publishedSlugList: string[];
	try {
		dbEvents = await fetchDbEvents(supabaseUrl, serviceRoleKey);
		publishedSlugList = await fetchPublishedContentSlugs(supabaseUrl, serviceRoleKey);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (values.allowMissingDb && message === 'fetch failed') {
			console.warn(
				'[DB] Supabase is configured but unreachable. Skipping DB comparison due to --allowMissingDb.',
			);
			return;
		}
		throw error;
	}
	const publishedSlugs = new Set(publishedSlugList);
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
		(event) =>
			!contentMap.has(entryKey(event.eventType, event.slug)) &&
			!publishedSlugs.has(entryKey(event.eventType, event.slug)),
	);
	const missingInDb = contentEvents.filter(
		(event) => !dbMap.has(entryKey(event.eventType, event.slug)),
	);

	console.log('Event parity report');
	console.log('===================');
	console.log(`Content events considered: ${contentEvents.length}`);
	console.log(`DB events considered: ${filteredDbEvents.length}`);

	printMismatch('Missing content for DB event', missingInContent as MismatchRow[]);
	printMismatch('Missing DB event for content', missingInDb as MismatchRow[]);

	if (missingInContent.length > 0 || missingInDb.length > 0) {
		process.exitCode = 1;
		return;
	}

	console.log('Parity validation passed.');
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
