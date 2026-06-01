import type { Invitation } from '@/lib/intake/types';
import {
	listInvitations,
	createInvitation as createInvitationRecord,
	findInvitationById,
	findInvitationBySlug,
	updateInvitation,
} from '@/lib/intake/repositories/invitation.repository';
import { DEMO_PRESET_CATALOG, findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { InvitationDTO } from '@/lib/dashboard/dto/intake';
import { resolveCaptureLink } from '@/lib/intake/services/intake-request.service';
import { toInvitationDTO } from '@/lib/dashboard/dto/intake-mapper';
import { hasRsvpContent } from '@/lib/intake/utils';
import type { IntakeRequest } from '@/lib/intake/types';
import { getCollection } from 'astro:content';
import { getContentEntrySlug } from '@/lib/content/events';
import { upsertPublishedContent } from '@/lib/intake/repositories/published-invitation-content.repository';
import {
	findDraftByInvitationId,
	upsertDraft,
} from '@/lib/intake/repositories/invitation-content-draft.repository';
import { ApiError } from '@/lib/rsvp/core/errors';

export function toEnrichedInvitationDTO(
	invitation: Invitation,
	input: {
		request?: Pick<IntakeRequest, 'status' | 'expiresAt' | 'tokenCiphertext'> | null;
		hasSubmission?: boolean;
		published?: boolean;
		rsvpEvent?: { id: string; status: string } | null;
		rsvpSectionHasContent?: boolean;
	} = {},
): InvitationDTO {
	return {
		...toInvitationDTO(invitation),
		hasRequest: Boolean(input.request),
		hasSubmission: input.hasSubmission ?? false,
		published: input.published ?? false,
		rsvpEventStatus: input.rsvpEvent?.status ?? null,
		rsvpEventId: input.rsvpEvent?.id ?? null,
		rsvpSectionHasContent: input.rsvpSectionHasContent ?? false,
		...resolveCaptureLink(input.request ?? null),
	};
}

export async function getEnrichedInvitationList(
	scope: 'active' | 'archived' | 'all' = 'active',
): Promise<InvitationDTO[]> {
	const invitations = await listInvitations(scope);
	const invitationIds = invitations.map((p) => p.id);
	if (invitationIds.length === 0) return [];

	const [requestRows, eventRows, pubRows, submissionRows, draftRows] = await Promise.all([
		supabaseRestRequest<
			Array<{
				id: string;
				invitation_project_id: string;
				token_ciphertext: string | null;
				origin: string;
				status: string;
				expires_at: string | null;
				enabled_blocks: unknown;
			}>
		>({
			pathWithQuery: `intake_requests?select=id,invitation_project_id,token_ciphertext,origin,status,expires_at,enabled_blocks&origin=eq.client&invitation_project_id=in.(${invitationIds.map(encodeURIComponent).join(',')})`,
			useServiceRole: true,
		}),
		supabaseRestRequest<Array<{ id: string; invitation_project_id: string; status: string }>>({
			pathWithQuery: `events?select=id,invitation_project_id,status&invitation_project_id=in.(${invitationIds.map(encodeURIComponent).join(',')})&deleted_at=is.null`,
			useServiceRole: true,
		}),
		supabaseRestRequest<
			Array<{ invitation_project_id: string; id: string; content: Record<string, unknown> }>
		>({
			pathWithQuery: `published_invitation_content?select=id,invitation_project_id,content&invitation_project_id=in.(${invitationIds.map(encodeURIComponent).join(',')})`,
			useServiceRole: true,
		}),
		supabaseRestRequest<Array<{ id: string; intake_request_id: string }>>({
			pathWithQuery: `intake_submissions?select=id,intake_request_id,intake_requests!inner(invitation_project_id)&intake_requests.invitation_project_id=in.(${invitationIds.map(encodeURIComponent).join(',')})`,
			useServiceRole: true,
		}),
		supabaseRestRequest<
			Array<{ invitation_project_id: string; content: Record<string, unknown> }>
		>({
			pathWithQuery: `invitation_content_drafts?select=invitation_project_id,content&invitation_project_id=in.(${invitationIds.map(encodeURIComponent).join(',')})`,
			useServiceRole: true,
		}),
	]);

	const requestIdToInvitation = new Map(
		requestRows.map((r) => [r.id, r.invitation_project_id] as const),
	);
	const eventsByInvitation = new Map(eventRows.map((e) => [e.invitation_project_id, e] as const));
	const publishedSet = new Set(pubRows.map((p) => p.invitation_project_id));
	const submissionInvitationIds = new Set<string>();
	for (const row of submissionRows) {
		const pid = requestIdToInvitation.get(row.intake_request_id);
		if (pid) submissionInvitationIds.add(pid);
	}

	const rsvpContentInvitations = new Set<string>();
	for (const row of pubRows) {
		if (hasRsvpContent(row.content)) {
			rsvpContentInvitations.add(row.invitation_project_id);
		}
	}
	for (const row of draftRows) {
		if (hasRsvpContent(row.content)) {
			rsvpContentInvitations.add(row.invitation_project_id);
		}
	}

	return invitations.map((invitation) => {
		const rawRequest =
			requestRows.find((r) => r.invitation_project_id === invitation.id) ?? null;
		const event = eventsByInvitation.get(invitation.id);
		return toEnrichedInvitationDTO(invitation, {
			request: rawRequest
				? {
						status: rawRequest.status as IntakeRequest['status'],
						expiresAt: rawRequest.expires_at,
						tokenCiphertext: rawRequest.token_ciphertext,
					}
				: null,
			hasSubmission: submissionInvitationIds.has(invitation.id),
			published: publishedSet.has(invitation.id),
			rsvpEvent: event ?? null,
			rsvpSectionHasContent: rsvpContentInvitations.has(invitation.id),
		});
	});
}

export async function createInvitation(input: {
	title: string;
	eventType: string;
	baseDemoId: string;
	slug?: string | null;
	clientName?: string;
	clientEmail?: string;
	clientWhatsapp?: string;
	createdBy?: string | null;
}): Promise<Invitation> {
	const preset = findDemoPreset(input.baseDemoId);
	if (!preset) {
		throw new Error(`Demo preset not found: ${input.baseDemoId}`);
	}

	return createInvitationRecord({
		title: input.title,
		eventType: input.eventType,
		baseDemoId: input.baseDemoId,
		themeId: preset.themeId,
		snapshot: preset,
		slug: input.slug,
		clientName: input.clientName,
		clientEmail: input.clientEmail,
		clientWhatsapp: input.clientWhatsapp,
		createdBy: input.createdBy,
	});
}

export async function synchronizeDemoInvitations(createdBy: string): Promise<void> {
	const demoEntries = await getCollection('event-demos');

	for (const preset of DEMO_PRESET_CATALOG) {
		const existing = await findInvitationBySlug(preset.previewSlug, true);
		if (existing) continue;

		const entry = demoEntries.find(
			(item: { id: string }) => getContentEntrySlug(item.id) === preset.previewSlug,
		);
		if (!entry) continue;

		const invitation = await createInvitationRecord({
			title: preset.displayName,
			eventType: preset.eventType,
			baseDemoId: preset.id,
			themeId: preset.themeId,
			snapshot: preset,
			slug: preset.previewSlug,
			kind: 'demo',
			createdBy,
		});

		await upsertPublishedContent({
			invitationId: invitation.id,
			slug: preset.previewSlug,
			eventType: preset.eventType,
			isDemo: true,
			content: { ...(entry.data as Record<string, unknown>), isDemo: true },
		});
		await updateInvitation(invitation.id, { status: 'published' });
	}
}

export async function duplicateInvitationFromDemo(
	demoInvitationId: string,
	input: {
		title: string;
		clientName?: string;
		clientEmail?: string;
		clientWhatsapp?: string;
		createdBy: string;
	},
): Promise<Invitation> {
	const demo = await findInvitationById(demoInvitationId);
	if (!demo || demo.kind !== 'demo') {
		throw new ApiError(404, 'not_found', 'Demo no encontrado.');
	}

	const invitation = await createInvitationRecord({
		title: input.title,
		eventType: demo.eventType,
		baseDemoId: demo.baseDemoId,
		themeId: demo.themeId,
		snapshot: demo.snapshot,
		kind: 'client',
		sourceInvitationId: demo.id,
		clientName: input.clientName,
		clientEmail: input.clientEmail,
		clientWhatsapp: input.clientWhatsapp,
		createdBy: input.createdBy,
	});

	const demoDraft = await findDraftByInvitationId(demo.id);
	if (demoDraft) {
		await upsertDraft({
			invitationId: invitation.id,
			submissionId: null,
			content: demoDraft.content,
		});
	}

	return invitation;
}
