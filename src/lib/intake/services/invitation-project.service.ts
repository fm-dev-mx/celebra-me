import type { InvitationProject } from '@/lib/intake/types';
import {
	listInvitationProjects,
	findInvitationProjectById,
	findInvitationProjectBySlug,
	createInvitationProject,
	updateInvitationProject,
} from '@/lib/intake/repositories/invitation-project.repository';
import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';

export async function getAllInvitationProjects(): Promise<InvitationProject[]> {
	return listInvitationProjects();
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
