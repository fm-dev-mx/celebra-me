import type { InvitationProjectDTO } from '@/lib/dashboard/dto/intake';
import { PROJECT_STATUS_LABELS } from '@/lib/intake/labels';

export type StatusBadgeVariant =
	| 'draft'
	| 'published'
	| 'archived'
	| 'active'
	| 'waiting'
	| 'submitted'
	| 'review'
	| 'production'
	| 'preview'
	| 'approved'
	| 'inconsistent'
	| 'generic';

export interface DisplayStatusInfo {
	label: string;
	variant: StatusBadgeVariant;
	warning: string | null;
}

export interface PrimaryAction {
	text: string;
	href?: string;
}

export function hasInconsistency(project: InvitationProjectDTO): boolean {
	return (
		(project.status === 'published' && !project.published) ||
		(project.status === 'published' && project.published && !project.rsvpEventStatus) ||
		(project.published && project.status !== 'published')
	);
}

function getPublicSlug(project: InvitationProjectDTO): string {
	return project.slug ?? `${project.eventType}-${project.id.slice(0, 8)}`;
}

export function resolveDisplayInfo(project: InvitationProjectDTO): DisplayStatusInfo {
	if (project.status === 'archived') {
		return { label: PROJECT_STATUS_LABELS.archived, variant: 'archived', warning: null };
	}

	if (hasInconsistency(project)) {
		if (project.status === 'published' && !project.published) {
			return {
				label: PROJECT_STATUS_LABELS.published,
				variant: 'inconsistent',
				warning: 'El proyecto está marcado como publicado pero no tiene contenido público.',
			};
		}
		if (project.status === 'published' && project.published && !project.rsvpEventStatus) {
			return {
				label: PROJECT_STATUS_LABELS.published,
				variant: 'published',
				warning: 'No se encontró el evento RSVP asociado a esta publicación.',
			};
		}
		if (project.published && project.status !== 'published') {
			return {
				label: PROJECT_STATUS_LABELS[project.status] ?? project.status,
				variant: 'inconsistent',
				warning:
					'El contenido público existe pero el proyecto no está marcado como publicado.',
			};
		}
	}

	switch (project.status) {
		case 'draft':
			return { label: PROJECT_STATUS_LABELS.draft, variant: 'draft', warning: null };
		case 'waiting_for_client':
			return {
				label: PROJECT_STATUS_LABELS.waiting_for_client,
				variant: 'waiting',
				warning: null,
			};
		case 'client_submitted':
			return {
				label: PROJECT_STATUS_LABELS.client_submitted,
				variant: 'submitted',
				warning: null,
			};
		case 'in_review':
			return { label: PROJECT_STATUS_LABELS.in_review, variant: 'review', warning: null };
		case 'in_production':
			return {
				label: PROJECT_STATUS_LABELS.in_production,
				variant: 'production',
				warning: null,
			};
		case 'preview_sent':
			return { label: PROJECT_STATUS_LABELS.preview_sent, variant: 'preview', warning: null };
		case 'approved':
			return { label: PROJECT_STATUS_LABELS.approved, variant: 'approved', warning: null };
		case 'published':
			return { label: PROJECT_STATUS_LABELS.published, variant: 'published', warning: null };
		default:
			return { label: project.status, variant: 'generic', warning: null };
	}
}

export function resolvePrimaryAction(project: InvitationProjectDTO): PrimaryAction | null {
	if (hasInconsistency(project)) {
		return { text: 'Revisar proyecto', href: `/dashboard/invitaciones/${project.id}` };
	}

	switch (project.status) {
		case 'draft':
			return {
				text: 'Generar link de captura',
				href: `/dashboard/invitaciones/${project.id}`,
			};
		case 'waiting_for_client':
			return { text: 'Esperando respuesta del cliente' };
		case 'client_submitted':
			return {
				text: 'Revisar captura',
				href: `/dashboard/invitaciones/${project.id}/review`,
			};
		case 'in_review':
			return { text: 'En revisión' };
		case 'in_production':
			return { text: 'Continuar producción', href: `/dashboard/invitaciones/${project.id}` };
		case 'preview_sent':
			return { text: 'Esperando aprobación final' };
		case 'approved':
			return {
				text: 'Generar borrador',
				href: `/dashboard/invitaciones/${project.id}/draft`,
			};
		case 'published':
			return {
				text: 'Ver invitación pública',
				href: `/${project.eventType}/${getPublicSlug(project)}`,
			};
		case 'archived':
			return { text: 'Archivada' };
		default:
			return null;
	}
}
