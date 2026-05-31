import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { InvitationProject, DemoPreset } from '@/lib/intake/types';
import { ACTIVE_FILTER } from '@/lib/intake/repositories/_constants';

interface InvitationProjectRow {
	id: string;
	slug: string | null;
	title: string;
	event_type: string;
	status: string;
	base_demo_id: string;
	theme_id: string;
	snapshot: DemoPreset;
	client_name: string;
	client_email: string;
	client_whatsapp: string;
	photos_received: boolean;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

function toInvitationProject(row: InvitationProjectRow): InvitationProject {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		eventType: row.event_type as InvitationProject['eventType'],
		status: row.status as InvitationProject['status'],
		baseDemoId: row.base_demo_id,
		themeId: row.theme_id,
		snapshot: row.snapshot,
		clientName: row.client_name,
		clientEmail: row.client_email,
		clientWhatsapp: row.client_whatsapp,
		photosReceived: row.photos_received,
		createdBy: row.created_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

const SELECT_COLUMNS =
	'id,slug,title,event_type,status,base_demo_id,theme_id,snapshot,client_name,client_email,client_whatsapp,photos_received,created_by,created_at,updated_at';

export async function listInvitationProjects(): Promise<InvitationProject[]> {
	const rows = await supabaseRestRequest<InvitationProjectRow[]>({
		pathWithQuery: `invitation_projects?select=${SELECT_COLUMNS}&${ACTIVE_FILTER}&order=created_at.desc`,
		useServiceRole: true,
	});
	return rows.map(toInvitationProject);
}

export async function findInvitationProjectById(id: string): Promise<InvitationProject | null> {
	const rows = await supabaseRestRequest<InvitationProjectRow[]>({
		pathWithQuery: `invitation_projects?select=${SELECT_COLUMNS}&id=eq.${encodeURIComponent(id)}&${ACTIVE_FILTER}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toInvitationProject(rows[0]) : null;
}

export async function findInvitationProjectBySlug(slug: string): Promise<InvitationProject | null> {
	const rows = await supabaseRestRequest<InvitationProjectRow[]>({
		pathWithQuery: `invitation_projects?select=${SELECT_COLUMNS}&slug=eq.${encodeURIComponent(slug)}&${ACTIVE_FILTER}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toInvitationProject(rows[0]) : null;
}

export async function createInvitationProject(input: {
	title: string;
	eventType: string;
	baseDemoId: string;
	themeId: string;
	snapshot: DemoPreset;
	slug?: string | null;
	clientName?: string;
	clientEmail?: string;
	clientWhatsapp?: string;
	createdBy?: string | null;
}): Promise<InvitationProject> {
	const body: Record<string, unknown> = {
		title: input.title,
		event_type: input.eventType,
		base_demo_id: input.baseDemoId,
		theme_id: input.themeId,
		snapshot: input.snapshot,
	};

	if (input.slug !== undefined) body.slug = input.slug;
	if (input.clientName !== undefined) body.client_name = input.clientName;
	if (input.clientEmail !== undefined) body.client_email = input.clientEmail;
	if (input.clientWhatsapp !== undefined) body.client_whatsapp = input.clientWhatsapp;
	if (input.createdBy !== undefined) body.created_by = input.createdBy;

	const rows = await supabaseRestRequest<InvitationProjectRow[]>({
		pathWithQuery: `invitation_projects?select=${SELECT_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});

	if (!rows[0]) throw new Error('Failed to create invitation project.');
	return toInvitationProject(rows[0]);
}

export async function updateInvitationProject(
	id: string,
	input: {
		title?: string;
		slug?: string | null;
		status?: string;
		clientName?: string;
		clientEmail?: string;
		clientWhatsapp?: string;
		photosReceived?: boolean;
	},
): Promise<InvitationProject> {
	const body: Record<string, unknown> = {};
	if (input.title !== undefined) body.title = input.title;
	if (input.slug !== undefined) body.slug = input.slug;
	if (input.status !== undefined) body.status = input.status;
	if (input.clientName !== undefined) body.client_name = input.clientName;
	if (input.clientEmail !== undefined) body.client_email = input.clientEmail;
	if (input.clientWhatsapp !== undefined) body.client_whatsapp = input.clientWhatsapp;
	if (input.photosReceived !== undefined) body.photos_received = input.photosReceived;

	const rows = await supabaseRestRequest<InvitationProjectRow[]>({
		pathWithQuery: `invitation_projects?id=eq.${encodeURIComponent(id)}&select=${SELECT_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});

	if (!rows[0]) throw new Error('Invitation project not found.');
	return toInvitationProject(rows[0]);
}
