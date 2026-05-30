import type { InvitationProject } from '@/lib/intake/types';
import {
	listInvitationProjects,
	findInvitationProjectById,
	findInvitationProjectBySlug,
	createInvitationProject,
	updateInvitationProject,
} from '@/lib/intake/repositories/invitation-project.repository';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { supabaseRestRequest } from '@/lib/rsvp/repositories/supabase';
import { toInvitationProjectDTO } from '@/lib/dashboard/dto/intake-mapper';
import type { InvitationProjectDTO } from '@/lib/dashboard/dto/intake';

export async function getAllInvitationProjects(): Promise<InvitationProject[]> {
	return listInvitationProjects();
}

export async function getEnrichedProjectList(): Promise<InvitationProjectDTO[]> {
	const projects = await listInvitationProjects();
	const projectIds = projects.map((p) => p.id);

	const [requestRows, eventRows, pubRows, submissionRows] = await Promise.all([
		supabaseRestRequest<Array<{ invitation_project_id: string; id: string }>>({
			pathWithQuery: `intake_requests?select=id,invitation_project_id&invitation_project_id=in.(${projectIds.map(encodeURIComponent).join(',')})&deleted_at=is.null`,
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
			pathWithQuery: `intake_submissions?select=id,intake_request_id,intake_request!inner(invitation_project_id)&intake_request.invitation_project_id=in.(${projectIds.map(encodeURIComponent).join(',')})`,
			useServiceRole: true,
		}),
	]);

	const requestProjectIds = new Set(
		(Array.isArray(requestRows) ? requestRows : []).map((r) => r.invitation_project_id),
	);
	const requestIdToProject = new Map(
		(Array.isArray(requestRows) ? requestRows : []).map(
			(r) => [r.id, r.invitation_project_id] as const,
		),
	);
	const eventsByProject = new Map(
		(Array.isArray(eventRows) ? eventRows : []).map(
			(e) => [e.invitation_project_id, e] as const,
		),
	);
	const publishedSet = new Set(
		(Array.isArray(pubRows) ? pubRows : []).map((p) => p.invitation_project_id),
	);
	const submissionProjectIds = new Set<string>();
	for (const row of Array.isArray(submissionRows) ? submissionRows : []) {
		const pid = requestIdToProject.get(row.intake_request_id);
		if (pid) submissionProjectIds.add(pid);
	}

	return projects.map((project) => {
		const base = toInvitationProjectDTO(project);
		const event = eventsByProject.get(project.id) ?? null;
		return {
			...base,
			hasRequest: requestProjectIds.has(project.id),
			hasSubmission: submissionProjectIds.has(project.id),
			published: publishedSet.has(project.id),
			rsvpEventStatus: event?.status ?? null,
			rsvpEventId: event?.id ?? null,
		};
	});
}

export async function getInvitationProjectById(id: string): Promise<InvitationProject | null> {
	return findInvitationProjectById(id);
}

export async function getInvitationProjectBySlug(slug: string): Promise<InvitationProject | null> {
	return findInvitationProjectBySlug(slug);
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

export async function updateProject(
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
	return updateInvitationProject(id, input);
}
