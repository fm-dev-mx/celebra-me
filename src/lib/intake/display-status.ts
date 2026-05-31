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

export interface RepairAction {
	text: string;
	explanation: string;
	href?: string;
}

interface InconsistencyRule {
	check: (project: InvitationProjectDTO) => boolean;
	getInfo: (project: InvitationProjectDTO) => DisplayStatusInfo;
	getRepair: (project: InvitationProjectDTO) => RepairAction;
}

const INCONSISTENCY_RULES: InconsistencyRule[] = [
	{
		check: (p) => p.status === 'published' && !p.published,
		getInfo: () => ({
			label: PROJECT_STATUS_LABELS.published,
			variant: 'inconsistent' as StatusBadgeVariant,
			warning: 'El proyecto está marcado como publicado pero no tiene contenido público.',
		}),
		getRepair: (p) => ({
			text: 'Volver a publicar',
			explanation:
				'El proyecto está marcado como publicado pero no tiene contenido público. Si existe un borrador, puedes volver a publicarlo desde la página del borrador.',
			href: `/dashboard/invitaciones/${p.id}/draft`,
		}),
	},
	{
		check: (p) => p.status === 'published' && p.published && !p.rsvpEventStatus,
		getInfo: () => ({
			label: PROJECT_STATUS_LABELS.published,
			variant: 'published' as StatusBadgeVariant,
			warning: 'No se encontró el evento RSVP asociado a esta publicación.',
		}),
		getRepair: (p) => ({
			text: 'Reparar publicación',
			explanation:
				'El proyecto está publicado pero no se encontró el evento RSVP asociado. Vuelve a publicar para crear o restaurar el evento RSVP.',
			href: `/dashboard/invitaciones/${p.id}/draft`,
		}),
	},
	{
		check: (p) => p.published && p.status !== 'published',
		getInfo: (p) => ({
			label: PROJECT_STATUS_LABELS[p.status] ?? p.status,
			variant: 'inconsistent' as StatusBadgeVariant,
			warning: 'El contenido público existe pero el proyecto no está marcado como publicado.',
		}),
		getRepair: (p) => ({
			text: 'Sincronizar estado',
			explanation:
				'El contenido público existe pero el proyecto no está marcado como publicado. Actualiza el estado del proyecto para reflejar su estado real.',
			href: `/dashboard/invitaciones/${p.id}`,
		}),
	},
];

function findMatchingRule(project: InvitationProjectDTO): InconsistencyRule | undefined {
	return INCONSISTENCY_RULES.find((rule) => rule.check(project));
}

export function hasInconsistency(project: InvitationProjectDTO): boolean {
	return findMatchingRule(project) !== undefined;
}

function getPublicSlug(project: InvitationProjectDTO): string {
	return project.slug ?? `${project.eventType}-${project.id.slice(0, 8)}`;
}

export function resolveDisplayInfo(project: InvitationProjectDTO): DisplayStatusInfo {
	if (project.status === 'archived') {
		return { label: PROJECT_STATUS_LABELS.archived, variant: 'archived', warning: null };
	}

	const rule = findMatchingRule(project);
	if (rule) return rule.getInfo(project);

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

export function resolveRepairAction(project: InvitationProjectDTO): RepairAction | null {
	const rule = findMatchingRule(project);
	return rule ? rule.getRepair(project) : null;
}

export function resolvePrimaryAction(project: InvitationProjectDTO): PrimaryAction | null {
	const rule = findMatchingRule(project);
	if (rule) {
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
