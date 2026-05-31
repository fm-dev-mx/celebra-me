import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { ACTIVE_FILTER } from '@/lib/intake/repositories/_constants';

interface PublishedInvitationContentRow {
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

interface PublishedInvitationContent {
	id: string;
	invitationProjectId: string;
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
		invitationProjectId: row.invitation_project_id,
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

export async function findPublishedByProjectId(
	invitationProjectId: string,
): Promise<PublishedInvitationContent | null> {
	const rows = await supabaseRestRequest<PublishedInvitationContentRow[]>({
		pathWithQuery: `published_invitation_content?select=${SELECT_COLUMNS}&invitation_project_id=eq.${encodeURIComponent(invitationProjectId)}&${ACTIVE_FILTER}&limit=1`,
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

export interface UpsertPublishedInput {
	invitationProjectId: string;
	slug: string;
	eventType: string;
	isDemo: boolean;
	content: Record<string, unknown>;
}

export async function upsertPublishedContent(
	input: UpsertPublishedInput,
): Promise<PublishedInvitationContent> {
	const existing = await findPublishedByProjectId(input.invitationProjectId);

	if (existing) {
		const rows = await supabaseRestRequest<PublishedInvitationContentRow[]>({
			pathWithQuery: `published_invitation_content?id=eq.${encodeURIComponent(existing.id)}&select=${SELECT_COLUMNS}`,
			method: 'PATCH',
			useServiceRole: true,
			prefer: 'return=representation',
			body: {
				content: input.content,
				slug: input.slug,
				version: existing.version + 1,
				published_at: new Date().toISOString(),
			},
		});
		if (!rows[0]) throw new Error('Failed to update published invitation content.');
		return toRow(rows[0]);
	}

	const rows = await supabaseRestRequest<PublishedInvitationContentRow[]>({
		pathWithQuery: `published_invitation_content?select=${SELECT_COLUMNS}`,
		method: 'POST',
		useServiceRole: true,
		prefer: 'return=representation',
		body: {
			invitation_project_id: input.invitationProjectId,
			slug: input.slug,
			event_type: input.eventType,
			is_demo: input.isDemo,
			content: input.content,
			version: 1,
			published_at: new Date().toISOString(),
		},
	});
	if (!rows[0]) throw new Error('Failed to create published invitation content.');
	return toRow(rows[0]);
}
