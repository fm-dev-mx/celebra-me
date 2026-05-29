import type { APIRoute } from 'astro';
import { requireAdminStrongSession } from '@/lib/rsvp/auth/authorization';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { validateCsrfToken, shouldSkipCsrfValidation } from '@/lib/rsvp/security/csrf';
import { validateBodyOrRespond } from '@/lib/rsvp/core/validation';
import { errorResponse, jsonResponse } from '@/lib/rsvp/core/http';
import {
	getAllInvitationProjects,
	createProject,
} from '@/lib/intake/services/invitation-project.service';
import { CreateInvitationProjectSchema } from '@/lib/intake/schemas/invitation-project.schema';
import type { InvitationProjectDTO } from '@/lib/dashboard/dto/intake';
import { toInvitationProjectDTO } from '@/lib/dashboard/dto/intake-mapper';

export const GET: APIRoute = async ({ request }) => {
	try {
		await requireAdminRateLimit(request, 'intake:list');
		await requireAdminStrongSession(request);

		const projects = await getAllInvitationProjects();
		const items: InvitationProjectDTO[] = projects.map(toInvitationProjectDTO);

		return jsonResponse({ items });
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	try {
		await requireAdminRateLimit(request, 'intake:create');

		if (!shouldSkipCsrfValidation(new URL(request.url).pathname)) {
			validateCsrfToken(request, cookies);
		}

		const session = await requireAdminStrongSession(request);

		const parsed = await validateBodyOrRespond(request, CreateInvitationProjectSchema);
		if (parsed instanceof Response) return parsed;

		const project = await createProject({
			title: parsed.title,
			eventType: parsed.eventType,
			baseDemoId: parsed.baseDemoId,
			slug: parsed.slug,
			clientName: parsed.clientName,
			clientEmail: parsed.clientEmail,
			clientWhatsapp: parsed.clientWhatsapp,
			createdBy: session.userId,
		});

		return jsonResponse({ item: toInvitationProjectDTO(project) }, 201);
	} catch (error) {
		return errorResponse(error);
	}
};
