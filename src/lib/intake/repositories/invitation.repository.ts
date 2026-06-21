import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { Invitation, DemoPreset } from '@/lib/intake/types';

interface InvitationRow {
	id: string;
	kind: string;
	source_invitation_id: string | null;
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
	archived_at: string | null;
	created_at: string;
	updated_at: string;
}

function toInvitation(row: InvitationRow): Invitation {
	return {
		id: row.id,
		kind: row.kind as Invitation['kind'],
		sourceInvitationId: row.source_invitation_id,
		slug: row.slug,
		title: row.title,
		eventType: row.event_type as Invitation['eventType'],
		status: row.status as Invitation['status'],
		baseDemoId: row.base_demo_id,
		themeId: row.theme_id,
		snapshot: row.snapshot,
		clientName: row.client_name,
		clientEmail: row.client_email,
		clientWhatsapp: row.client_whatsapp,
		photosReceived: row.photos_received,
		createdBy: row.created_by,
		archivedAt: row.archived_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

const SELECT_COLUMNS =
	'id,kind,source_invitation_id,slug,title,event_type,status,base_demo_id,theme_id,snapshot,client_name,client_email,client_whatsapp,photos_received,created_by,archived_at,created_at,updated_at';

export async function listInvitations(
	scope: 'active' | 'archived' | 'all' = 'active',
): Promise<Invitation[]> {
	const archiveFilter =
		scope === 'all' ? '' : `&archived_at=${scope === 'active' ? 'is.null' : 'not.is.null'}`;
	const rows = await supabaseRestRequest<InvitationRow[]>({
		pathWithQuery: `invitations?select=${SELECT_COLUMNS}${archiveFilter}&order=updated_at.desc`,
		useServiceRole: true,
	});
	return rows.map(toInvitation);
}

export async function findInvitationById(
	id: string,
	includeArchived = false,
): Promise<Invitation | null> {
	const archiveFilter = includeArchived ? '' : '&archived_at=is.null';
	const rows = await supabaseRestRequest<InvitationRow[]>({
		pathWithQuery: `invitations?select=${SELECT_COLUMNS}&id=eq.${encodeURIComponent(id)}${archiveFilter}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toInvitation(rows[0]) : null;
}

export async function findInvitationBySlug(
	slug: string,
	includeArchived = false,
): Promise<Invitation | null> {
	const archiveFilter = includeArchived ? '' : '&archived_at=is.null';
	const rows = await supabaseRestRequest<InvitationRow[]>({
		pathWithQuery: `invitations?select=${SELECT_COLUMNS}&slug=eq.${encodeURIComponent(slug)}${archiveFilter}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toInvitation(rows[0]) : null;
}

export async function createInvitation(input: {
	title: string;
	eventType: string;
	baseDemoId: string;
	themeId: string;
	snapshot: DemoPreset;
	kind?: Invitation['kind'];
	sourceInvitationId?: string | null;
	slug?: string | null;
	clientName?: string;
	clientEmail?: string;
	clientWhatsapp?: string;
	createdBy?: string | null;
}): Promise<Invitation> {
	const body: Record<string, unknown> = {
		title: input.title,
		event_type: input.eventType,
		base_demo_id: input.baseDemoId,
		theme_id: input.themeId,
		snapshot: input.snapshot,
		kind: input.kind ?? 'client',
	};

	if (input.sourceInvitationId !== undefined)
		body.source_invitation_id = input.sourceInvitationId;
	if (input.slug !== undefined) body.slug = input.slug;
	if (input.clientName !== undefined) body.client_name = input.clientName;
	if (input.clientEmail !== undefined) body.client_email = input.clientEmail;
	if (input.clientWhatsapp !== undefined) body.client_whatsapp = input.clientWhatsapp;
	if (input.createdBy !== undefined) body.created_by = input.createdBy;

	const rows = await supabaseRestRequest<InvitationRow[]>({
		pathWithQuery: `invitations?select=${SELECT_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});

	if (!rows[0]) throw new Error('Failed to create invitation.');
	return toInvitation(rows[0]);
}

function buildUpdateBody(input: {
	title?: string;
	slug?: string | null;
	status?: string;
	clientName?: string;
	clientEmail?: string;
	clientWhatsapp?: string;
	photosReceived?: boolean;
	sourceInvitationId?: string | null;
}): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (input.title !== undefined) body.title = input.title;
	if (input.slug !== undefined) body.slug = input.slug;
	if (input.status !== undefined) body.status = input.status;
	if (input.clientName !== undefined) body.client_name = input.clientName;
	if (input.clientEmail !== undefined) body.client_email = input.clientEmail;
	if (input.clientWhatsapp !== undefined) body.client_whatsapp = input.clientWhatsapp;
	if (input.photosReceived !== undefined) body.photos_received = input.photosReceived;
	if (input.sourceInvitationId !== undefined)
		body.source_invitation_id = input.sourceInvitationId;
	return body;
}

export async function updateInvitation(
	id: string,
	input: Parameters<typeof buildUpdateBody>[0],
): Promise<Invitation> {
	const body = buildUpdateBody(input);

	const rows = await supabaseRestRequest<InvitationRow[]>({
		pathWithQuery: `invitations?id=eq.${encodeURIComponent(id)}&select=${SELECT_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});

	if (!rows[0]) throw new Error('Invitation not found.');
	return toInvitation(rows[0]);
}

export async function assignInvitationOwner(
	id: string,
	ownerUserId: string,
): Promise<Invitation | null> {
	const pathWithQuery = `invitations?id=eq.${encodeURIComponent(id)}&select=${SELECT_COLUMNS}`;

	const rows = await supabaseRestRequest<InvitationRow[]>({
		pathWithQuery,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			created_by: ownerUserId,
		},
	});

	return rows[0] ? toInvitation(rows[0]) : null;
}

export async function updateInvitationConditionally(
	id: string,
	expectedUpdatedAt: string,
	input: Parameters<typeof buildUpdateBody>[0],
): Promise<Invitation | null> {
	const body = buildUpdateBody(input);

	const rows = await supabaseRestRequest<InvitationRow[]>({
		pathWithQuery: `invitations?id=eq.${encodeURIComponent(id)}&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}&select=${SELECT_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body,
	});

	return rows[0] ? toInvitation(rows[0]) : null;
}
