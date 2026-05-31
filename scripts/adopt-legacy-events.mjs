#!/usr/bin/env node
/* eslint-disable complexity */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const REPORT_FILE = path.join(
	PROJECT_ROOT,
	'.agent',
	'plans',
	'reports',
	'adoption-backfill-report.json',
);

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

async function main() {
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

	console.log('╔══════════════════════════════════════════════════════════════════╗');
	console.log('║  Stage 1.5  Controlled adoption: legacy RSVP events            ║');
	console.log('╚══════════════════════════════════════════════════════════════════╝');
	console.log(`\nStarted: ${new Date().toISOString()}`);
	console.log('');

	// 1. Load orphan events (events with no invitation_project_id)
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

	// Check if migration is applied (column exists)
	const sampleEvent = Array.isArray(events) && events.length > 0 ? events[0] : null;
	if (sampleEvent && !('invitation_project_id' in sampleEvent)) {
		console.error('ERROR: invitation_project_id column not found on events table.');
		console.error('  Apply the migration first:');
		console.error('  supabase/migrations/20260531000000_add_events_invitation_project_id.sql');
		process.exit(1);
	}

	const orphanEvents = (Array.isArray(events) ? events : []).filter(
		(e) => !e.invitation_project_id,
	);

	console.log(`Total events:        ${(Array.isArray(events) ? events : []).length}`);
	console.log(`Orphan events:       ${orphanEvents.length}`);
	console.log('');

	if (orphanEvents.length === 0) {
		console.log('No orphan events to adopt. Nothing to do.');
		return;
	}

	// 2. Load existing projects to check slug conflicts
	const existingProjects = await restGet('invitations', 'select=id,slug,event_type,title');
	const existingSlugs = new Set(
		(Array.isArray(existingProjects) ? existingProjects : [])
			.map((p) => p.slug)
			.filter(Boolean),
	);

	// 3. Load guest and claim code counts for verification
	const allGuests = await restGet('guest_invitations', 'select=event_id,attendance_status');
	const guestMap = new Map();
	for (const g of Array.isArray(allGuests) ? allGuests : []) {
		if (!guestMap.has(g.event_id)) guestMap.set(g.event_id, []);
		guestMap.get(g.event_id).push(g);
	}

	const allClaims = await restGet('event_claim_codes', 'select=event_id');
	const claimMap = new Map();
	for (const c of Array.isArray(allClaims) ? allClaims : []) {
		if (!claimMap.has(c.event_id)) claimMap.set(c.event_id, []);
		claimMap.get(c.event_id).push(c);
	}

	// 4. Create projects and link events
	const adoptions = [];
	const errors = [];

	for (const ev of orphanEvents) {
		console.log(`\nProcessing: ${ev.slug} (${ev.event_type}) "${ev.title}"`);

		// Check slug conflict
		if (existingSlugs.has(ev.slug)) {
			const conflict = (Array.isArray(existingProjects) ? existingProjects : []).find(
				(p) => p.slug === ev.slug,
			);
			errors.push({
				eventId: ev.id,
				slug: ev.slug,
				reason: `Slug "${ev.slug}" already in use by project ${conflict?.id}`,
			});
			console.log(`  ⚠ SKIP: slug conflict with project ${conflict?.id}`);
			continue;
		}

		const baseDemoId = BASE_DEMO_BY_TYPE[ev.event_type] || 'demo-xv-jewelry-box';

		// Create project
		let project;
		try {
			const projectBody = {
				title: ev.title,
				event_type: ev.event_type,
				slug: ev.slug,
				status: ev.status || 'draft',
				base_demo_id: baseDemoId,
				theme_id: 'jewelry-box',
				snapshot: {
					id: baseDemoId,
					eventType: ev.event_type,
					displayName: 'Adoptado de evento legacy',
					themeId: 'jewelry-box',
					previewSlug: baseDemoId,
				},
				client_name: '',
				client_email: '',
				client_whatsapp: '',
			};
			if (ev.owner_user_id) projectBody.created_by = ev.owner_user_id;

			const created = await restPost(
				'invitations',
				projectBody,
				`select=id,slug,event_type,title,status`,
			);
			project = Array.isArray(created) ? created[0] : created;
			console.log(`  ✓ Project created: ${project.id}`);
		} catch (err) {
			errors.push({
				eventId: ev.id,
				slug: ev.slug,
				reason: `Failed to create project: ${err.message}`,
			});
			console.log(`  ✗ Failed to create project: ${err.message}`);
			continue;
		}

		// Link event to project
		try {
			const updated = await restPatch(
				'events',
				{ invitation_project_id: project.id },
				`id=eq.${ev.id}&select=id,slug,invitation_project_id`,
			);
			console.log(`  ✓ Event linked to project: ${updated[0]?.invitation_project_id}`);
		} catch (err) {
			errors.push({
				eventId: ev.id,
				slug: ev.slug,
				reason: `Failed to link event: ${err.message}`,
			});
			console.log(`  ✗ Failed to link event: ${err.message}`);
			continue;
		}

		existingSlugs.add(ev.slug);

		const guests = guestMap.get(ev.id) || [];
		const claims = claimMap.get(ev.id) || [];

		adoptions.push({
			eventId: ev.id,
			slug: ev.slug,
			projectId: project.id,
			guestCount: guests.length,
			claimCodeCount: claims.length,
		});
	}

	// 5. Verification: re-check events
	const updatedEvents = await restGet(
		'events',
		'select=id,slug,event_type,title,status,invitation_project_id,owner_user_id',
	);
	const remainingOrphans = (Array.isArray(updatedEvents) ? updatedEvents : []).filter(
		(e) => !e.invitation_project_id,
	);
	const linkedEvents = (Array.isArray(updatedEvents) ? updatedEvents : []).filter(
		(e) => e.invitation_project_id,
	);

	// Check no duplicate project links
	const projectLinks = new Map();
	for (const e of linkedEvents) {
		if (!projectLinks.has(e.invitation_project_id))
			projectLinks.set(e.invitation_project_id, []);
		projectLinks.get(e.invitation_project_id).push(e);
	}
	const duplicateLinks = [...projectLinks.entries()].filter(([, evts]) => evts.length > 1);

	// Check guest and claim counts preserved
	const verifyGuests = await restGet('guest_invitations', 'select=event_id');
	const verifyGuestMap = new Map();
	for (const g of Array.isArray(verifyGuests) ? verifyGuests : []) {
		if (!verifyGuestMap.has(g.event_id)) verifyGuestMap.set(g.event_id, 0);
		verifyGuestMap.set(g.event_id, verifyGuestMap.get(g.event_id) + 1);
	}

	const verifyClaims = await restGet('event_claim_codes', 'select=event_id');
	const verifyClaimMap = new Map();
	for (const c of Array.isArray(verifyClaims) ? verifyClaims : []) {
		if (!verifyClaimMap.has(c.event_id)) verifyClaimMap.set(c.event_id, 0);
		verifyClaimMap.set(c.event_id, verifyClaimMap.get(c.event_id) + 1);
	}

	// Build report
	const report = {
		meta: {
			generatedAt: new Date().toISOString(),
			tool: 'scripts/adopt-legacy-events.mjs',
			description: 'Stage 1.5 — Controlled adoption backfill report',
		},
		adoptions,
		errors,
		verification: {
			totalEventsBefore: Array.isArray(events) ? events.length : 0,
			totalEventsAfter: Array.isArray(updatedEvents) ? updatedEvents.length : 0,
			orphansBefore: orphanEvents.length,
			orphansAfter: remainingOrphans.length,
			linkedEvents: linkedEvents.length,
			eventsWithDuplicateProjectLinks: duplicateLinks.length,
			duplicateLinkDetails: duplicateLinks.map(([pid, evts]) => ({
				projectId: pid,
				eventSlugs: evts.map((e) => e.slug),
			})),
			guestCountsPreserved: true,
			claimCodeCountsPreserved: true,
		},
	};

	// Verify guest counts per event
	for (const adoption of adoptions) {
		const before = guestMap.get(adoption.eventId)?.length || 0;
		const after = verifyGuestMap.get(adoption.eventId) || 0;
		if (before !== after) {
			report.verification.guestCountsPreserved = false;
			console.log(`  ⚠ Guest count changed for ${adoption.slug}: ${before} → ${after}`);
		}
	}

	for (const adoption of adoptions) {
		const before = claimMap.get(adoption.eventId)?.length || 0;
		const after = verifyClaimMap.get(adoption.eventId) || 0;
		if (before !== after) {
			report.verification.claimCodeCountsPreserved = false;
			console.log(`  ⚠ Claim code count changed for ${adoption.slug}: ${before} → ${after}`);
		}
	}

	// Write report
	fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
	fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

	// Summary
	console.log(`\n${'═'.repeat(60)}`);
	console.log('ADOPTION SUMMARY');
	console.log(`${'═'.repeat(60)}`);
	console.log(`  Events adopted:      ${adoptions.length}`);
	console.log(`  Errors:              ${errors.length}`);
	console.log(`  Remaining orphans:   ${remainingOrphans.length}`);
	console.log(`  Duplicate links:     ${duplicateLinks.length}`);

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

	console.log(`\nReport: ${REPORT_FILE}`);
	console.log(`${'═'.repeat(60)}\n`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
