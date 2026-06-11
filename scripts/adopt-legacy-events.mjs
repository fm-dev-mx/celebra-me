#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_EVENTS_DIR = path.join(PROJECT_ROOT, 'src', 'content', 'events');

const REPORT_FILE = path.join(
	PROJECT_ROOT,
	'.agent',
	'plans',
	'reports',
	'adoption-backfill-report.json',
);

const SNAPSHOT_DEFAULTS = {
	defaultSections: [
		'quote',
		'family',
		'gallery',
		'countdown',
		'location',
		'itinerary',
		'rsvp',
		'gifts',
		'thankYou',
	],
	supportedBlocks: [
		'event-details',
		'main-people',
		'date-locations',
		'photos',
		'rsvp-config',
		'music',
		'gifts',
		'special-messages',
	],
	recommendedBlocks: [
		'event-details',
		'main-people',
		'date-locations',
		'photos',
		'rsvp-config',
		'gifts',
		'special-messages',
	],
	requiredAssets: ['hero', 'portrait', 'gallery01', 'gallery02', 'gallery03'],
};

function loadEnvFile(relativePath) {
	const envPath = path.join(PROJECT_ROOT, relativePath);
	if (!fs.existsSync(envPath)) return;
	const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq === -1) continue;
		const key = line.slice(0, eq).trim();
		let val = line.slice(eq + 1).trim();
		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		) {
			val = val.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = val;
	}
}

function toArray(v) {
	return Array.isArray(v) ? v : [];
}

function isPlaceholder(v) {
	const n = String(v || '')
		.trim()
		.toLowerCase();
	return !n || n.includes('your-supabase') || n.includes('changeme');
}

function baseUrl() {
	return (process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/rest/v1';
}

function authHeaders() {
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	return {
		apikey: key,
		Authorization: `Bearer ${key}`,
		Accept: 'application/json',
		'Content-Type': 'application/json',
	};
}

async function restGet(table, query = '') {
	const url = `${baseUrl()}/${table}${query ? `?${query}` : ''}`;
	const res = await fetch(url, { headers: authHeaders() });
	if (!res.ok) throw new Error(`${table} GET (${res.status}): ${await res.text()}`);
	return res.json();
}

async function restPost(table, body, query = '') {
	const url = `${baseUrl()}/${table}${query ? `?${query}` : ''}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { ...authHeaders(), Prefer: 'return=representation' },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`${table} POST (${res.status}): ${await res.text()}`);
	return res.json();
}

async function restPatch(table, body, query = '') {
	const url = `${baseUrl()}/${table}${query ? `?${query}` : ''}`;
	const res = await fetch(url, {
		method: 'PATCH',
		headers: { ...authHeaders(), Prefer: 'return=representation' },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`${table} PATCH (${res.status}): ${await res.text()}`);
	return res.json();
}

const BASE_DEMO_BY_TYPE = {
	xv: 'demo-xv-jewelry-box',
	boda: 'demo-boda-jewelry-box-wedding',
	bautizo: 'demo-bautismo-angelic-presence',
	cumple: 'demo-cumple-luxury-hacienda',
};

const THEME_FALLBACK_BY_TYPE = {
	xv: 'jewelry-box',
	boda: 'jewelry-box-wedding',
	bautizo: 'angelic-presence',
	cumple: 'luxury-hacienda',
};

function resolveActualTheme(slug, eventType, contentEventsDir) {
	const defaultThemeId = THEME_FALLBACK_BY_TYPE[eventType];
	const fallback = defaultThemeId || 'editorial';

	if (defaultThemeId === undefined) {
		console.warn(`  ⚠ No theme fallback for event type "${eventType}", using "editorial"`);
	}

	const contentPath = path.join(contentEventsDir, `${slug}.json`);
	if (!fs.existsSync(contentPath)) {
		console.warn(`  ⚠ No content file for "${slug}", using event-type fallback: "${fallback}"`);
		console.warn(`      Create src/content/events/${slug}.json with the correct theme.preset`);
		return fallback;
	}

	try {
		const eventContent = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
		const actualTheme = eventContent.theme?.preset;
		if (actualTheme && typeof actualTheme === 'string') {
			console.log(`  ✓ Resolved theme from content: "${actualTheme}"`);
			return actualTheme;
		}
		console.warn(`  ⚠ File "${slug}.json" has no theme.preset, using fallback: "${fallback}"`);
		return fallback;
	} catch (err) {
		console.warn(
			`  ⚠ Failed to parse "${slug}.json": ${err.message}. Using fallback: "${fallback}"`,
		);
		return fallback;
	}
}

function buildProjectBody(event, baseDemoId, actualTheme) {
	const body = {
		title: event.title,
		event_type: event.event_type,
		slug: event.slug,
		status: event.status || 'draft',
		base_demo_id: baseDemoId,
		theme_id: actualTheme,
		snapshot: {
			id: baseDemoId,
			eventType: event.event_type,
			displayName: 'Adoptado de evento legacy',
			themeId: actualTheme,
			...SNAPSHOT_DEFAULTS,
			previewSlug: baseDemoId,
		},
		client_name: '',
		client_email: '',
		client_whatsapp: '',
	};
	if (event.owner_user_id) body.created_by = event.owner_user_id;
	return body;
}

function buildMap(items, key) {
	const map = new Map();
	for (const item of toArray(items)) {
		const k = item[key];
		if (!map.has(k)) map.set(k, []);
		map.get(k).push(item);
	}
	return map;
}

function loadConfiguration() {
	loadEnvFile('.env.local');
	loadEnvFile('.env');

	const dbUrl = process.env.SUPABASE_URL || '';
	const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
	if (isPlaceholder(dbUrl) || isPlaceholder(dbKey)) {
		console.error(
			'ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local',
		);
		process.exit(1);
	}
}

async function fetchEvents() {
	let events;
	try {
		events = await restGet(
			'events',
			'select=id,slug,event_type,title,status,owner_user_id,invitation_project_id',
		);
	} catch (err) {
		console.error('Failed to load events. Has the migration been applied yet?');
		console.error(
			'  Run the migration SQL in supabase/migrations/20260531000000_add_events_invitation_project_id.sql',
		);
		console.error(`  Error: ${err.message}`);
		process.exit(1);
	}

	const sampleEvent = toArray(events)[0] ?? null;
	if (sampleEvent && !('invitation_project_id' in sampleEvent)) {
		console.error('ERROR: invitation_project_id column not found on events table.');
		console.error('  Apply the migration first:');
		console.error('  supabase/migrations/20260531000000_add_events_invitation_project_id.sql');
		process.exit(1);
	}

	return events;
}

async function processOrphanEvent(ev, existingSlugs, existingProjects, guestMap, claimMap) {
	console.log(`\nProcessing: ${ev.slug} (${ev.event_type}) "${ev.title}"`);

	if (existingSlugs.has(ev.slug)) {
		const conflict = toArray(existingProjects).find((p) => p.slug === ev.slug);
		return {
			error: {
				eventId: ev.id,
				slug: ev.slug,
				reason: `Slug "${ev.slug}" already in use by project ${conflict?.id}`,
			},
		};
	}

	const baseDemoId = BASE_DEMO_BY_TYPE[ev.event_type] || 'demo-xv-jewelry-box';
	const actualTheme = resolveActualTheme(ev.slug, ev.event_type, CONTENT_EVENTS_DIR);

	let project;
	try {
		const projectBody = buildProjectBody(ev, baseDemoId, actualTheme);
		const created = await restPost(
			'invitations',
			projectBody,
			'select=id,slug,event_type,title,status',
		);
		project = toArray(created)[0] ?? created;
		console.log(`  ✓ Project created: ${project.id}`);
	} catch (err) {
		return {
			error: {
				eventId: ev.id,
				slug: ev.slug,
				reason: `Failed to create project: ${err.message}`,
			},
		};
	}

	try {
		const updated = await restPatch(
			'events',
			{ invitation_project_id: project.id },
			`id=eq.${ev.id}&select=id,slug,invitation_project_id`,
		);
		console.log(`  ✓ Event linked to project: ${updated[0]?.invitation_project_id}`);
	} catch (err) {
		return {
			error: {
				eventId: ev.id,
				slug: ev.slug,
				reason: `Failed to link event: ${err.message}`,
			},
		};
	}

	const guests = guestMap.get(ev.id) || [];
	const claims = claimMap.get(ev.id) || [];

	return {
		adoption: {
			eventId: ev.id,
			slug: ev.slug,
			projectId: project.id,
			guestCount: guests.length,
			claimCodeCount: claims.length,
		},
	};
}

function buildReport(
	eventsBefore,
	eventsAfter,
	adoptions,
	errors,
	orphanEventsBefore,
	orphanEventsAfter,
	duplicateLinks,
) {
	return {
		meta: {
			generatedAt: new Date().toISOString(),
			tool: 'scripts/adopt-legacy-events.mjs',
			description: 'Stage 1.5 — Controlled adoption backfill report',
		},
		adoptions,
		errors,
		verification: {
			totalEventsBefore: toArray(eventsBefore).length,
			totalEventsAfter: toArray(eventsAfter).length,
			orphansBefore: orphanEventsBefore.length,
			orphansAfter: orphanEventsAfter.length,
			linkedEvents:
				orphanEventsAfter === 0
					? toArray(eventsAfter).length
					: toArray(eventsAfter).filter((e) => e.invitation_project_id).length,
			eventsWithDuplicateProjectLinks: duplicateLinks.length,
			duplicateLinkDetails: duplicateLinks.map(([pid, evts]) => ({
				projectId: pid,
				eventSlugs: evts.map((e) => e.slug),
			})),
		},
	};
}

function printSummary(adoptions, errors, remainingOrphans, orphanEvents, reportFile) {
	console.log(`\n${'═'.repeat(60)}`);
	console.log('ADOPTION SUMMARY');
	console.log(`${'═'.repeat(60)}`);
	console.log(`  Events adopted:      ${adoptions.length}`);
	console.log(`  Errors:              ${errors.length}`);
	console.log(`  Remaining orphans:   ${remainingOrphans.length}`);

	if (adoptions.length > 0) {
		console.log('\nAdopted events:');
		for (const a of adoptions) {
			console.log(
				`  ✓ ${a.slug} → project ${a.projectId} (${a.guestCount} guests, ${a.claimCodeCount} codes)`,
			);
		}
	}

	if (errors.length > 0) {
		console.log('\nErrors:');
		for (const e of errors) {
			console.log(`  ✗ ${e.slug}: ${e.reason}`);
		}
	}

	if (remainingOrphans.length > 0 && remainingOrphans.length === orphanEvents.length) {
		console.log('\n⚠ No orphans were adopted. Migration may not be applied yet.');
	}

	console.log(`\nReport: ${reportFile}`);
	console.log(`${'═'.repeat(60)}\n`);
}

async function main() {
	loadConfiguration();

	console.log('╔══════════════════════════════════════════════════════════════════╗');
	console.log('║  Stage 1.5  Controlled adoption: legacy RSVP events            ║');
	console.log('╚══════════════════════════════════════════════════════════════════╝');
	console.log(`\nStarted: ${new Date().toISOString()}\n`);

	const events = await fetchEvents();
	const orphanEvents = toArray(events).filter((e) => !e.invitation_project_id);

	console.log(`Total events:        ${toArray(events).length}`);
	console.log(`Orphan events:       ${orphanEvents.length}\n`);

	if (orphanEvents.length === 0) {
		console.log('No orphan events to adopt. Nothing to do.');
		return;
	}

	const existingProjects = await restGet('invitations', 'select=id,slug,event_type,title');
	const existingSlugs = new Set(
		toArray(existingProjects)
			.map((p) => p.slug)
			.filter(Boolean),
	);

	const allGuests = await restGet('guest_invitations', 'select=event_id,attendance_status');
	const guestMap = buildMap(allGuests, 'event_id');

	const allClaims = await restGet('event_claim_codes', 'select=event_id');
	const claimMap = buildMap(allClaims, 'event_id');

	const adoptions = [];
	const errors = [];

	for (const ev of orphanEvents) {
		const result = await processOrphanEvent(
			ev,
			existingSlugs,
			existingProjects,
			guestMap,
			claimMap,
		);
		if (result.error) {
			errors.push(result.error);
		}
		if (result.adoption) {
			existingSlugs.add(ev.slug);
			adoptions.push(result.adoption);
		}
	}

	const updatedEvents = await restGet(
		'events',
		'select=id,slug,event_type,title,status,invitation_project_id,owner_user_id',
	);
	const remainingOrphans = toArray(updatedEvents).filter((e) => !e.invitation_project_id);
	const linkedEvents = toArray(updatedEvents).filter((e) => e.invitation_project_id);

	const projectLinks = buildMap(linkedEvents, 'invitation_project_id');
	const duplicateLinks = [...projectLinks.entries()].filter(([, evts]) => evts.length > 1);

	const report = buildReport(
		events,
		updatedEvents,
		adoptions,
		errors,
		orphanEvents,
		remainingOrphans,
		duplicateLinks,
	);

	fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
	fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

	printSummary(adoptions, errors, remainingOrphans, orphanEvents, REPORT_FILE);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
