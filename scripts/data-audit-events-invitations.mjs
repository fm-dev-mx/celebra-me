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
	'data-audit-events-invitations.json',
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
	return { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
}

async function fetchPage(table, select, offset, limit) {
	const params = new URLSearchParams({ select, limit: String(limit), offset: String(offset) });
	const url = `${baseUrl()}/${table}?${params}`;
	const res = await fetch(url, { headers: authHeaders() });
	if (!res.ok) throw new Error(`${table} (${res.status}): ${await res.text()}`);
	return res.json();
}

async function fetchAll(table, select = '*') {
	const limit = 1000;
	let offset = 0;
	let rows = [];
	while (true) {
		const batch = await fetchPage(table, select, offset, limit);
		if (!Array.isArray(batch) || batch.length === 0) break;
		rows = rows.concat(batch);
		if (batch.length < limit) break;
		offset += limit;
	}
	return rows;
}

function fmtCount(n, label) {
	return `  ${String(n).padStart(5)}  ${label}`;
}

function fmtSection(title) {
	const len = title.length;
	console.log(`\n${'━'.repeat(Math.min(len, 72))}`);
	console.log(title);
	console.log(`${'━'.repeat(Math.min(len, 72))}`);
}

function buildMaps(published, invitations, guestRows, claimRows) {
	const pubByKey = new Map();
	for (const p of published) pubByKey.set(`${p.event_type}:${p.slug}`, p);

	const projectBySlug = new Map();
	for (const p of invitations) if (p.slug) projectBySlug.set(p.slug, p);

	const guestsByEvent = new Map();
	for (const g of guestRows)
		guestsByEvent.set(g.event_id, (guestsByEvent.get(g.event_id) || 0) + 1);

	const claimsByEvent = new Map();
	for (const c of claimRows)
		claimsByEvent.set(c.event_id, (claimsByEvent.get(c.event_id) || 0) + 1);

	return { pubByKey, projectBySlug, guestsByEvent, claimsByEvent };
}

function classifyEvent(ev, invitations, maps) {
	const { pubByKey, projectBySlug, guestsByEvent, claimsByEvent } = maps;
	const key = `${ev.event_type}:${ev.slug}`;
	const pubRow = pubByKey.get(key);
	const hasGuests = guestsByEvent.has(ev.id);
	const hasClaims = claimsByEvent.has(ev.id);
	const guestCount = guestsByEvent.get(ev.id) || 0;
	const claimCount = claimsByEvent.get(ev.id) || 0;

	if (pubRow && pubRow.invitation_project_id) {
		return { tag: 'matched', event: ev, pubRow, hasGuests, hasClaims, guestCount, claimCount };
	}
	const proj = projectBySlug.get(ev.slug);
	if (proj && proj.event_type === ev.event_type) {
		return {
			tag: 'matched_fallback',
			event: ev,
			proj,
			hasGuests,
			hasClaims,
			guestCount,
			claimCount,
		};
	}
	const matches = invitations.filter((p) => p.slug === ev.slug);
	if (matches.length > 1) {
		return {
			tag: 'ambiguous',
			event: ev,
			matches,
			hasGuests,
			hasClaims,
			guestCount,
			claimCount,
		};
	}
	return { tag: 'orphan', event: ev, hasGuests, hasClaims, guestCount, claimCount };
}

function buildReport(events, invitations, published, guestRows, claimRows) {
	const maps = buildMaps(published, invitations, guestRows, claimRows);
	const matched = [],
		ambiguous = [],
		orphaned = [];
	const matchedInvitationIds = new Set();

	for (const ev of events) {
		const result = classifyEvent(ev, invitations, maps);
		if (result.tag === 'matched') {
			matched.push({
				eventId: ev.id,
				slug: ev.slug,
				eventType: ev.event_type,
				title: ev.title,
				status: ev.status,
				invitationId: result.pubRow.invitation_project_id,
				matchSource: 'published_content',
				hasGuests: result.hasGuests,
				guestCount: result.guestCount,
				hasClaims: result.hasClaims,
				claimCount: result.claimCount,
			});
			matchedInvitationIds.add(result.pubRow.invitation_project_id);
		} else if (result.tag === 'matched_fallback') {
			matched.push({
				eventId: ev.id,
				slug: ev.slug,
				eventType: ev.event_type,
				title: ev.title,
				status: ev.status,
				invitationId: result.proj.id,
				matchSource: 'direct_project_slug',
				hasGuests: result.hasGuests,
				guestCount: result.guestCount,
				hasClaims: result.hasClaims,
				claimCount: result.claimCount,
			});
			matchedInvitationIds.add(result.proj.id);
		} else if (result.tag === 'ambiguous') {
			ambiguous.push({
				eventId: ev.id,
				slug: ev.slug,
				eventType: ev.event_type,
				title: ev.title,
				status: ev.status,
				matchingProjectIds: result.matches.map((p) => ({
					id: p.id,
					eventType: p.event_type,
					title: p.title,
				})),
				hasGuests: result.hasGuests,
				guestCount: result.guestCount,
				hasClaims: result.hasClaims,
				claimCount: result.claimCount,
			});
		} else {
			orphaned.push({
				eventId: ev.id,
				slug: ev.slug,
				eventType: ev.event_type,
				title: ev.title,
				status: ev.status,
				hasGuests: result.hasGuests,
				guestCount: result.guestCount,
				hasClaims: result.hasClaims,
				claimCount: result.claimCount,
			});
		}
	}

	const publishedProjects = invitations.filter((p) => p.status === 'published');
	const projectsWithoutEvent = publishedProjects.filter((p) => !matchedInvitationIds.has(p.id));

	const eventsByProject = new Map();
	for (const m of matched) {
		if (!m.invitationId) continue;
		if (!eventsByProject.has(m.invitationId)) eventsByProject.set(m.invitationId, []);
		eventsByProject.get(m.invitationId).push(m);
	}
	const multiEventProjects = [...eventsByProject.entries()]
		.filter(([, evts]) => evts.length > 1)
		.map(([pid, evts]) => ({
			projectId: pid,
			invitation: invitations.find((p) => p.id === pid),
			eventCount: evts.length,
			eventSlugs: evts.map((e) => e.slug),
			eventIds: evts.map((e) => e.eventId),
		}));

	return {
		meta: {
			generatedAt: new Date().toISOString(),
			tool: 'scripts/data-audit-events-invitations.mjs',
			description:
				'Stage 0 data audit for migration of /dashboard/eventos into /dashboard/invitaciones',
			matchingStrategy:
				'PRIMARY: events → published_invitation_content via (event_type, slug) → invitation_project_id. FALLBACK: events → invitations via (event_type, slug) for unmatched.',
		},
		counts: {
			eventsTotal: events.length,
			invitationsTotal: invitations.length,
			publishedProjects: publishedProjects.length,
			publishedContentEntries: published.length,
			matchedEvents: matched.length,
			ambiguousEvents: ambiguous.length,
			orphanedEvents: orphaned.length,
			publishedProjectsWithoutEvent: projectsWithoutEvent.length,
			eventsWithGuests: [...maps.guestsByEvent.keys()].filter((id) =>
				events.some((e) => e.id === id),
			).length,
			eventsWithClaimCodes: [...maps.claimsByEvent.keys()].filter((id) =>
				events.some((e) => e.id === id),
			).length,
			projectsWithMultipleEvents: multiEventProjects.length,
		},
		matching: {
			byPublishedContent: matched.filter((m) => m.matchSource === 'published_content').length,
			byDirectProjectSlug: matched.filter((m) => m.matchSource === 'direct_project_slug')
				.length,
		},
		details: {
			matchedEvents: matched,
			ambiguousEvents: ambiguous,
			orphanedEvents: orphaned,
			projectsWithoutEvent: projectsWithoutEvent.map((p) => ({
				id: p.id,
				slug: p.slug,
				eventType: p.event_type,
				title: p.title,
				status: p.status,
			})),
			projectsWithMultipleEvents: multiEventProjects,
		},
		orphanEventsWithGuests: orphaned.filter((o) => o.hasGuests),
		orphanEventsWithClaimCodes: orphaned.filter((o) => o.hasClaims),
	};
}

function printReport(report) {
	fmtSection('1. CORE COUNTS');
	console.log(fmtCount(report.counts.eventsTotal, 'events'));
	console.log(fmtCount(report.counts.invitationsTotal, 'invitations'));
	console.log(fmtCount(report.counts.publishedProjects, 'published invitations'));
	console.log(
		fmtCount(report.counts.publishedContentEntries, 'published_invitation_content rows'),
	);

	fmtSection('2. MATCH RESULTS (event_type + slug)');
	console.log(fmtCount(report.counts.matchedEvents, 'events matched to a invitation'));
	console.log(`         ${report.matching.byPublishedContent} via published_invitation_content`);
	console.log(`         ${report.matching.byDirectProjectSlug} via direct invitation slug`);
	console.log(fmtCount(report.counts.ambiguousEvents, 'events matching multiple invitations'));
	console.log(fmtCount(report.counts.orphanedEvents, 'events matching NO invitation (orphaned)'));

	if (report.counts.ambiguousEvents > 0) {
		fmtSection('3. AMBIGUOUS EVENTS');
		for (const a of report.details.ambiguousEvents) {
			console.log(`  ${a.slug} (${a.eventType}) "${a.title}" [${a.status}]`);
			for (const p of a.matchingProjectIds)
				console.log(`    ${p.id} (${p.eventType}) "${p.title}"`);
		}
	} else {
		console.log(
			'\n  (No ambiguous matches — events.slug and invitations.slug are both UNIQUE.)',
		);
	}

	if (report.counts.orphanedEvents > 0) {
		fmtSection('4. ORPHANED EVENTS');
		for (const o of report.details.orphanedEvents) {
			const flags = [];
			if (o.hasGuests) flags.push(`${o.guestCount} guest(s)`);
			if (o.hasClaims) flags.push(`${o.claimCount} code(s)`);
			const flagStr = flags.length ? `  <══ HAS DATA: ${flags.join(', ')}` : '';
			console.log(`  ${o.slug} (${o.eventType}) [${o.status}] "${o.title}"${flagStr}`);
		}
	} else {
		console.log('\n  (No orphaned events)');
	}

	fmtSection('5. PUBLISHED PROJECTS WITHOUT A MATCHING EVENT');
	if (report.counts.publishedProjectsWithoutEvent > 0) {
		for (const p of report.details.projectsWithoutEvent) {
			console.log(`  ${p.title} (${p.eventType}) — slug: ${p.slug || '(auto)'}`);
		}
	} else {
		console.log('  (All published invitations have a matching event.)');
	}

	fmtSection('6. EVENTS WITH GUEST INVITATIONS / CLAIM CODES');
	console.log(fmtCount(report.counts.eventsWithGuests, 'events that have guest_invitations'));
	console.log(fmtCount(report.counts.eventsWithClaimCodes, 'events that have claim_codes'));

	const multi = report.details.projectsWithMultipleEvents;
	fmtSection('7. ONE-TO-ONE ASSESSMENT');
	if (report.counts.projectsWithMultipleEvents === 0) {
		console.log('\n  No invitation has more than one event.');
		console.log('  Domain supports exactly one RSVP event per invitation invitation.');
		console.log('  A partial unique index on events.invitation_project_id IS safe.');
	} else {
		console.log(`\n  ${report.counts.projectsWithMultipleEvents} invitation(s) have >1 event.`);
		for (const m of multi) {
			console.log(
				`  Project ${m.projectId}: ${m.eventCount} events — ${m.eventSlugs.join(', ')}`,
			);
		}
		console.log('  Partial unique index NOT safe without resolution.');
	}

	const orphanData = report.details.orphanedEvents.filter(
		(o) => o.hasGuests || o.hasClaims,
	).length;

	fmtSection('8. RISK ASSESSMENT');
	console.log('\n  FK will be NULLABLE — existing orphans remain untouched.');
	console.log('  Backfill will set invitation_project_id only for matched events.');
	console.log('  Manual review required for:');
	console.log(
		`    - ${report.counts.matchedEvents} events with clear invitation link (auto-backfill)`,
	);
	if (report.counts.ambiguousEvents > 0)
		console.log(`    - ${report.counts.ambiguousEvents} ambiguous events (needs resolution)`);
	if (orphanData > 0)
		console.log(`    - ${orphanData} orphaned events WITH guest/claim data (must not be lost)`);
	if (report.counts.publishedProjectsWithoutEvent > 0) {
		console.log(
			`    - ${report.counts.publishedProjectsWithoutEvent} published invitations without events (re-publish creates them)`,
		);
	}

	fmtSection('9. RECOMMENDATION');
	if (orphanData > 0) {
		console.log('\n  ⚠  HOLD — do not proceed to Stage 1 yet.');
		console.log(`     ${orphanData} orphaned events have guest_invitations or claim_codes.`);
		console.log('     These must be reviewed and linked to a invitation before backfill.');
		console.log(
			'     See "orphanEventsWithGuests" and "orphanEventsWithClaimCodes" in the JSON report.',
		);
	} else if (report.counts.orphanedEvents > 0) {
		console.log('\n  ⚠  PROCEED WITH CAUTION to Stage 1.');
		console.log(
			`     ${report.counts.orphanedEvents} orphaned events exist but have NO guest/claim data.`,
		);
		console.log('     They remain unlinked (NULL invitation_project_id). Acceptable.');
		if (report.counts.publishedProjectsWithoutEvent > 0) {
			console.log(
				`     Note: ${report.counts.publishedProjectsWithoutEvent} published invitations have no event yet.`,
			);
		}
		console.log('     Add the partial unique index (domain supports 1:1).');
	} else {
		console.log('\n  ✅  PROCEED to Stage 1.');
		console.log('     No orphaned events with data. Safe to add FK and backfill.');
		if (report.counts.publishedProjectsWithoutEvent > 0) {
			console.log(
				`     Note: ${report.counts.publishedProjectsWithoutEvent} published invitations have no event yet.`,
			);
		}
	}

	console.log(`\n${'═'.repeat(60)}`);
	console.log(`Full JSON report: ${REPORT_FILE}`);
}

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
	console.log('║  Stage 0  Data Audit: events  invitations              ║');
	console.log('║  Migration readiness assessment for /dashboard/eventos            ║');
	console.log('╚══════════════════════════════════════════════════════════════════╝');
	console.log(`\nStarted: ${new Date().toISOString()}`);
	console.log(`Environment: ${dbUrl.includes('supabase.co') ? 'Production' : 'Development'}`);
	console.log('\nFetching data from Supabase REST API (read-only)...\n');

	const [events, invitations, published, guestRows, claimRows] = await Promise.all([
		fetchAll('events', 'id,slug,event_type,title,status,owner_user_id,created_at,updated_at'),
		fetchAll('invitations', 'id,slug,event_type,title,status'),
		fetchAll('published_invitation_content', 'id,invitation_project_id,slug,event_type'),
		fetchAll('guest_invitations', 'event_id'),
		fetchAll('event_claim_codes', 'event_id'),
	]);

	console.log(`  ${String(events.length).padStart(5)}  events`);
	console.log(`  ${String(invitations.length).padStart(5)}  invitations`);
	console.log(`  ${String(published.length).padStart(5)}  published_invitation_content`);
	console.log(`  ${String(guestRows.length).padStart(5)}  guest_invitations`);
	console.log(`  ${String(claimRows.length).padStart(5)}  event_claim_codes`);

	const report = buildReport(events, invitations, published, guestRows, claimRows);

	fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
	fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
	console.log(`\nJSON report written to ${REPORT_FILE}`);

	printReport(report);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
