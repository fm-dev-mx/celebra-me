import type { InvitationProject } from '@/lib/intake/types';
import {
	listInvitationProjects,
	createInvitationProject,
} from '@/lib/intake/repositories/invitation-project.repository';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import type { InvitationProjectDTO } from '@/lib/dashboard/dto/intake';

export async function getEnrichedProjectList(): Promise<InvitationProjectDTO[]> {
	const projects = await listInvitationProjects();
	const projectIds = projects.map((p) => p.id);

	const [requestRows, eventRows, pubRows, submissionRows] = await Promise.all([
		supabaseRestRequest<Array<{ invitation_project_id: string; id: string }>>({
			pathWithQuery: `intake_requests?select=id,invitation_project_id&invitation_project_id=in.(${projectIds.map(encodeURIComponent).join(',')})`,
			useServiceRole: true,
		}),
		supabaseRestRequest<Array<{ id: string; invitation_project_id: string; status: string }>>({
			pathWithQuery: `events?select=id,invitation_project_id,status&invitation_project_id=in.(${projectIds.map(encodeURIComponent).join(',')})&deleted_at=is.null`,
			useServiceRole: true,
		}),
		supabaseRestRequest<Array<{ invitation_project_id: string; id: string }>>({
			pathWithQuery: `published_invitation_content?select=id,invitation_project_id&invitation_project_id=in.(${projectIds.map(encodeURIComponent).join(',')})`,
			useServiceRole: true,
		}),
		supabaseRestRequest<Array<{ id: string; intake_request_id: string }>>({
			pathWithQuery: `intake_submissions?select=id,intake_request_id,intake_requests!inner(invitation_project_id)&intake_requests.invitation_project_id=in.(${projectIds.map(encodeURIComponent).join(',')})`,
			useServiceRole: true,
		}),
	]);

	const requestProjectIds = new Set(requestRows.map((r) => r.invitation_project_id));
	const requestIdToProject = new Map(
		requestRows.map((r) => [r.id, r.invitation_project_id] as const),
	);
	const eventsByProject = new Map(eventRows.map((e) => [e.invitation_project_id, e] as const));
	const publishedSet = new Set(pubRows.map((p) => p.invitation_project_id));
	const submissionProjectIds = new Set<string>();
	for (const row of submissionRows) {
		const pid = requestIdToProject.get(row.intake_request_id);
		if (pid) submissionProjectIds.add(pid);
	}

	const eventForProject = (id: string) => eventsByProject.get(id) ?? null;
	return projects.map((project) => ({
		id: project.id,
		slug: project.slug,
		title: project.title,
		eventType: project.eventType,
		status: project.status,
		baseDemoId: project.baseDemoId,
		themeId: project.themeId,
		clientName: project.clientName,
		clientEmail: project.clientEmail,
		clientWhatsapp: project.clientWhatsapp,
		photosReceived: project.photosReceived,
		createdAt: project.createdAt,
		updatedAt: project.updatedAt,
		hasRequest: requestProjectIds.has(project.id),
		hasSubmission: submissionProjectIds.has(project.id),
		published: publishedSet.has(project.id),
		rsvpEventStatus: eventForProject(project.id)?.status ?? null,
		rsvpEventId: eventForProject(project.id)?.id ?? null,
	}));
}

export async function createProject(input: {
	title: string;
	eventType: string;
	baseDemoId: string;
	slug?: string | null;
	clientName?: string;
	clientEmail?: string;
	clientWhatsapp?: string;
	createdBy?: string | null;
}): Promise<InvitationProject> {
	const preset = findDemoPreset(input.baseDemoId);
	if (!preset) {
		throw new Error(`Demo preset not found: ${input.baseDemoId}`);
	}

	return createInvitationProject({
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
