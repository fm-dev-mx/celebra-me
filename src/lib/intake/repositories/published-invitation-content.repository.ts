import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { ACTIVE_FILTER } from '@/lib/intake/repositories/_constants';

export interface PublishedInvitationContentRow {
	id: string;
	invitation_project_id: string;
	slug: string;
	event_type: string;
	is_demo: boolean;
	content: Record<string, unknown>;
	version: number;
	published_at: string;
	created_at: string;
	updated_at: string;
}

export interface PublishedInvitationContent {
	id: string;
	invitationId: string;
	slug: string;
	eventType: string;
	isDemo: boolean;
	content: Record<string, unknown>;
	version: number;
	publishedAt: string;
	createdAt: string;
	updatedAt: string;
}

function toRow(row: PublishedInvitationContentRow): PublishedInvitationContent {
	return {
		id: row.id,
		invitationId: row.invitation_project_id,
		slug: row.slug,
		eventType: row.event_type,
		isDemo: row.is_demo,
		content: row.content,
		version: row.version,
		publishedAt: row.published_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

const SELECT_COLUMNS =
	'id,invitation_project_id,slug,event_type,is_demo,content,version,published_at,created_at,updated_at';

export async function findPublishedByInvitationId(
	invitationId: string,
): Promise<PublishedInvitationContent | null> {
	const rows = await supabaseRestRequest<PublishedInvitationContentRow[]>({
		pathWithQuery: `published_invitation_content?select=${SELECT_COLUMNS}&invitation_project_id=eq.${encodeURIComponent(invitationId)}&${ACTIVE_FILTER}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toRow(rows[0]) : null;
}

export async function findPublishedBySlugAndEventType(
	slug: string,
	eventType: string,
): Promise<PublishedInvitationContent | null> {
	const rows = await supabaseRestRequest<PublishedInvitationContentRow[]>({
		pathWithQuery: `published_invitation_content?select=${SELECT_COLUMNS}&slug=eq.${encodeURIComponent(slug)}&event_type=eq.${encodeURIComponent(eventType)}&${ACTIVE_FILTER}&limit=1`,
		useServiceRole: true,
	});
	return rows[0] ? toRow(rows[0]) : null;
}

export async function listPublishedByEventTypes(
	eventTypes: readonly string[],
): Promise<PublishedInvitationContent[]> {
	if (eventTypes.length === 0) return [];
	const encoded = eventTypes.map((eventType) => encodeURIComponent(eventType)).join(',');
	const rows = await supabaseRestRequest<PublishedInvitationContentRow[]>({
		pathWithQuery: `published_invitation_content?select=${SELECT_COLUMNS}&event_type=in.(${encoded})&${ACTIVE_FILTER}`,
		useServiceRole: true,
	});
	return rows.map(toRow);
}

export interface UpsertPublishedInput {
	invitationId: string;
	slug: string;
	eventType: string;
	isDemo: boolean;
	content: Record<string, unknown>;
}

export async function upsertPublishedContent(
	input: UpsertPublishedInput,
): Promise<PublishedInvitationContent> {
	const existing = await findPublishedByInvitationId(input.invitationId);

	if (existing) {
		const rows = await supabaseRestRequest<PublishedInvitationContentRow[]>({
			pathWithQuery: `published_invitation_content?id=eq.${encodeURIComponent(existing.id)}&select=${SELECT_COLUMNS}`,
			method: 'PATCH',
			useServiceRole: true,
			prefer: 'return=representation',
			body: {
				content: input.content,
				slug: input.slug,
				event_type: input.eventType,
				is_demo: input.isDemo,
				version: existing.version + 1,
				published_at: new Date().toISOString(),
			},
		});
		if (!rows[0])
			throw new Error(`Failed to update published invitation content (id: ${existing.id}).`);
		return toRow(rows[0]);
	}

	const rows = await supabaseRestRequest<PublishedInvitationContentRow[]>({
		pathWithQuery: `published_invitation_content?select=${SELECT_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			invitation_project_id: input.invitationId,
			slug: input.slug,
			event_type: input.eventType,
			is_demo: input.isDemo,
			content: input.content,
			version: 1,
			published_at: new Date().toISOString(),
		},
	});
	if (!rows[0])
		throw new Error(
			`Failed to create published invitation content (invitation: ${input.invitationId}).`,
		);
	return toRow(rows[0]);
}

export async function updatePublishedContentSnapshot(input: {
	id: string;
	content: Record<string, unknown>;
	version: number;
	publishedAt: string;
}): Promise<PublishedInvitationContent> {
	const rows = await supabaseRestRequest<PublishedInvitationContentRow[]>({
		pathWithQuery: `published_invitation_content?id=eq.${encodeURIComponent(input.id)}&select=${SELECT_COLUMNS}`,
		method: 'PATCH',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			content: input.content,
			version: input.version,
			published_at: input.publishedAt,
		},
	});
	if (!rows[0])
		throw new Error(
			`Failed to update published invitation content snapshot (id: ${input.id}).`,
		);
	return toRow(rows[0]);
}
