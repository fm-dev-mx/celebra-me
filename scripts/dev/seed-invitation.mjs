#!/usr/bin/env node

/**
 * Dev seed script for creating a mock invitation project in Supabase.
 *
 * PURPOSE:
 *   Creates a complete intake flow for development/testing:
 *   invitation_project → intake_request → intake_submission → draft
 *
 * USAGE:
 *   node scripts/dev/seed-invitation.mjs
 *
 * REQUIRES:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * DATA:
 *   All data below is synthetic placeholder data only.
 *   No real client PII is used.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env.local');
const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';

// ── Load .env.local ──────────────────────────────────────────────────
function loadEnv(filePath) {
	const content = fs.readFileSync(filePath, 'utf-8');
	const vars = {};
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eqIdx = trimmed.indexOf('=');
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		const val = trimmed
			.slice(eqIdx + 1)
			.trim()
			.replace(/^["']|["']$/g, '');
		vars[key] = val;
	}
	return vars;
}

const env = loadEnv(ENV_PATH);
const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
	console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
	process.exit(1);
}

// ── Environment guard ────────────────────────────────────────────────
const PRODUCTION_PATTERNS = ['supabase.co', 'project.dev', 'prod'];
const isProduction = PRODUCTION_PATTERNS.some((p) => supabaseUrl.includes(p));
if (isProduction) {
	console.error(
		'ERROR: SUPABASE_URL appears to point to production (%s). Aborting to prevent data contamination.',
		supabaseUrl,
	);
	process.exit(1);
}

// ── Supabase client (service role) ───────────────────────────────────
const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── Mock data ────────────────────────────────────────────────────────
const MOCK_TITLE = 'Invitación de Prueba — Desarrollo';
const MOCK_EVENT_TYPE = 'xv';
const MOCK_DEMO_ID = 'demo-xv-jewelry-box';
const MOCK_CLIENT = {
	name: 'Juan Pérez',
	email: 'cliente@example.com',
	whatsapp: '+521000000000',
};

const MOCK_BLOCK_DATA = {
	'event-details': {
		eventType: 'xv',
		title: MOCK_TITLE,
		description: 'Celebración de prueba para desarrollo.',
	},
	'main-people': {
		name: 'María García',
		secondaryName: '',
		label: 'Mis XV Años',
		nickname: 'Mary',
		fatherName: 'Juan García',
		motherName: 'Ana García',
	},
	'date-locations': {
		venueName: 'Salón de Eventos Principal',
		address: 'Av. Principal 123, Col. Centro',
		city: 'Ciudad de Prueba',
		date: '2026-12-31T20:00:00.000Z',
		time: '8:00 PM',
		dressCode: 'Formal',
	},
	photos: {
		heroPhoto: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
		generalNotes: 'Fotos de prueba para desarrollo.',
	},
	'rsvp-config': {
		title: 'Confirma tu asistencia',
		guestCap: 4,
		confirmationMode: 'api',
		whatsappPhone: '+521000000000',
	},
	music: {
		url: 'https://example.com/mock-audio.mp3',
		title: 'Canción de prueba',
	},
	gifts: {
		title: 'Mesa de regalos',
		items: [{ type: 'cash', title: 'Lluvia de sobres', text: 'Gracias por tu generosidad.' }],
	},
	'special-messages': {
		quoteText: 'Frase de prueba para desarrollo.',
		quoteAuthor: 'Anónimo',
		thankYouMessage: 'Gracias por ser parte de esta prueba.',
		closingName: 'María García',
	},
};

// ── Helpers ──────────────────────────────────────────────────────────
function generateToken() {
	return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
	return crypto.createHash('sha256').update(token).digest('hex');
}

function toIso(daysFromNow = 30) {
	const d = new Date();
	d.setDate(d.getDate() + daysFromNow);
	return d.toISOString();
}

function nowIso() {
	return new Date().toISOString();
}

// ── Print helpers ────────────────────────────────────────────────────
function printSummary({ project, request, rawToken, submission, draft }) {
	console.log('\n=== SEED INVITATION CREATED ===\n');
	console.log(`Project:     ${project.title} (${project.id})`);
	console.log(`Event Type:  ${project.eventType}`);
	console.log(`Client:      ${project.clientName} <${project.clientEmail}>`);
	console.log(`Status:      ${project.status}`);
	console.log('');
	console.log('Intake Request:');
	console.log(`  ID:       ${request.id}`);
	console.log(`  Status:   ${request.status}`);
	console.log(`  Expires:  ${request.expires_at || 'N/A'}`);
	console.log('');
	console.log('RAW TOKEN (for capture URL):');
	console.log(`  ${rawToken}`);
	console.log('');
	console.log('URLs:');
	console.log(`  Capture:   ${BASE_URL}/captura/${rawToken}`);
	console.log(
		`  Preview:   ${BASE_URL}/${project.eventType}/${project.slug || project.id}/preview`,
	);
	console.log(`  Dashboard: ${BASE_URL}/dashboard/invitaciones/${project.id}`);
	console.log(`  Review:    ${BASE_URL}/dashboard/invitaciones/${project.id}/review`);
	console.log('');
	console.log('Submission:');
	console.log(`  ID:     ${submission.id}`);
	console.log(`  Status: ${submission.status}`);
	console.log('');
	console.log('Draft:');
	console.log(`  ID:     ${draft?.id || 'N/A'}`);
	console.log(`  Status: ${draft?.status || 'N/A'}`);
	console.log('');
	console.log('=== DONE ===\n');
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
	console.log('Creating seed invitation...\n');

	// 1. Create invitation project
	const { data: project, error: projectErr } = await supabase
		.from('invitations')
		.insert({
			title: MOCK_TITLE,
			event_type: MOCK_EVENT_TYPE,
			base_demo_id: MOCK_DEMO_ID,
			status: 'draft',
			client_name: MOCK_CLIENT.name,
			client_email: MOCK_CLIENT.email,
			client_whatsapp: MOCK_CLIENT.whatsapp,
		})
		.select()
		.single();

	if (projectErr) {
		console.error('Failed to create project:', projectErr);
		process.exit(1);
	}
	console.log(`✓ Project created: ${project.id}`);

	// 2. Create intake request with raw token
	const rawToken = generateToken();
	const tokenHash = hashToken(rawToken);

	const { data: request, error: requestErr } = await supabase
		.from('intake_requests')
		.insert({
			invitation_project_id: project.id,
			token_hash: tokenHash,
			status: 'active',
			enabled_blocks: [
				'event-details',
				'main-people',
				'date-locations',
				'photos',
				'rsvp-config',
				'music',
				'gifts',
				'special-messages',
			],
			expires_at: toIso(30),
		})
		.select()
		.single();

	if (requestErr) {
		console.error('Failed to create intake request:', requestErr);
		process.exit(1);
	}
	console.log(`✓ Intake request created: ${request.id}`);

	// 3. Create intake submission
	const { data: submission, error: submissionErr } = await supabase
		.from('intake_submissions')
		.insert({
			intake_request_id: request.id,
			status: 'in_progress',
			block_data: MOCK_BLOCK_DATA,
		})
		.select()
		.single();

	if (submissionErr) {
		console.error('Failed to create intake submission:', submissionErr);
		process.exit(1);
	}
	console.log(`✓ Intake submission created: ${submission.id}`);

	// 4. Approve submission
	const { error: approveErr } = await supabase
		.from('intake_submissions')
		.update({ status: 'approved', reviewed_at: nowIso() })
		.eq('id', submission.id);

	if (approveErr) {
		console.error('Failed to approve submission:', approveErr);
		process.exit(1);
	}
	console.log('✓ Submission approved');

	// 5. Create draft
	const mockDraftContent = {
		hero: {
			name: MOCK_BLOCK_DATA['main-people'].name,
			label: MOCK_BLOCK_DATA['main-people'].label,
			date: MOCK_BLOCK_DATA['date-locations'].date,
		},
		family: {
			celebrantName: MOCK_BLOCK_DATA['main-people'].name,
			parents: {
				father: MOCK_BLOCK_DATA['main-people'].fatherName,
				mother: MOCK_BLOCK_DATA['main-people'].motherName,
			},
		},
		location: {
			reception: {
				venueName: MOCK_BLOCK_DATA['date-locations'].venueName,
				address: MOCK_BLOCK_DATA['date-locations'].address,
				city: MOCK_BLOCK_DATA['date-locations'].city,
				date: MOCK_BLOCK_DATA['date-locations'].date,
				time: MOCK_BLOCK_DATA['date-locations'].time,
			},
		},
		rsvp: {
			title: MOCK_BLOCK_DATA['rsvp-config'].title,
			guestCap: MOCK_BLOCK_DATA['rsvp-config'].guestCap,
			confirmationMode: MOCK_BLOCK_DATA['rsvp-config'].confirmationMode,
		},
		music: { url: MOCK_BLOCK_DATA.music.url, title: MOCK_BLOCK_DATA.music.title },
		gifts: MOCK_BLOCK_DATA.gifts,
		quote: {
			text: MOCK_BLOCK_DATA['special-messages'].quoteText,
			author: MOCK_BLOCK_DATA['special-messages'].quoteAuthor,
		},
		thankYou: {
			message: MOCK_BLOCK_DATA['special-messages'].thankYouMessage,
			closingName: MOCK_BLOCK_DATA['special-messages'].closingName,
		},
	};

	const { data: draft, error: draftErr } = await supabase
		.from('invitation_content_drafts')
		.insert({
			invitation_project_id: project.id,
			submission_id: submission.id,
			status: 'draft',
			content: mockDraftContent,
		})
		.select()
		.single();

	if (draftErr) {
		console.error('Failed to create draft:', draftErr);
		process.exit(1);
	}
	console.log(`✓ Draft created: ${draft.id}`);

	printSummary({ project, request, rawToken, submission, draft });
}

main().catch((err) => {
	console.error('Unexpected error:', err);
	process.exit(1);
});
