import type { InvitationDTO } from '@/lib/dashboard/dto/intake';
import { getPublicSlug } from '@/lib/intake/slug';
import { INVITATION_STATUS_LABELS } from '@/lib/intake/labels';

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
	check: (invitation: InvitationDTO) => boolean;
	getInfo: (invitation: InvitationDTO) => DisplayStatusInfo;
	getRepair: (invitation: InvitationDTO) => RepairAction;
}

const INCONSISTENCY_RULES: InconsistencyRule[] = [
	{
		check: (p) => p.status === 'published' && !p.published,
		getInfo: () => ({
			label: INVITATION_STATUS_LABELS.published,
			variant: 'inconsistent' as StatusBadgeVariant,
			warning: 'La invitación está marcada como publicada pero no tiene contenido público.',
		}),
		getRepair: (p) => ({
			text: 'Volver a publicar',
			explanation:
				'La invitación está marcada como publicada pero no tiene contenido público. Si existe un borrador, puedes volver a publicarlo desde la página del borrador.',
			href: `/dashboard/invitaciones/${p.id}/draft`,
		}),
	},
	{
		check: (p) =>
			p.kind === 'client' && p.status === 'published' && p.published && !p.rsvpEventStatus,
		getInfo: () => ({
			label: INVITATION_STATUS_LABELS.published,
			variant: 'published' as StatusBadgeVariant,
			warning: 'No se encontró el evento RSVP asociado a esta publicación.',
		}),
		getRepair: (p) => ({
			text: 'Reparar publicación',
			explanation:
				'La invitación está publicada pero no se encontró el evento RSVP asociado. Vuelve a publicar para crear o restaurar el evento RSVP.',
			href: `/dashboard/invitaciones/${p.id}/draft`,
		}),
	},
	{
		check: (p) => p.published && p.status !== 'published',
		getInfo: (p) => ({
			label: INVITATION_STATUS_LABELS[p.status] ?? p.status,
			variant: 'inconsistent' as StatusBadgeVariant,
			warning:
				'El contenido público existe pero la invitación no está marcada como publicada.',
		}),
		getRepair: (p) => ({
			text: 'Sincronizar estado',
			explanation:
				'El contenido público existe pero la invitación no está marcada como publicada. Actualiza el estado de la invitación para reflejar su estado real.',
			href: `/dashboard/invitaciones/${p.id}`,
		}),
	},
];

function findMatchingRule(invitation: InvitationDTO): InconsistencyRule | undefined {
	return INCONSISTENCY_RULES.find((rule) => rule.check(invitation));
}

export function hasInconsistency(invitation: InvitationDTO): boolean {
	return findMatchingRule(invitation) !== undefined;
}

const STATUS_DISPLAY: Record<string, { label: string; variant: StatusBadgeVariant }> = {
	draft: { label: INVITATION_STATUS_LABELS.draft, variant: 'draft' },
	waiting_for_client: { label: INVITATION_STATUS_LABELS.waiting_for_client, variant: 'waiting' },
	client_submitted: { label: INVITATION_STATUS_LABELS.client_submitted, variant: 'submitted' },
	in_review: { label: INVITATION_STATUS_LABELS.in_review, variant: 'review' },
	in_production: { label: INVITATION_STATUS_LABELS.in_production, variant: 'production' },
	preview_sent: { label: INVITATION_STATUS_LABELS.preview_sent, variant: 'preview' },
	approved: { label: INVITATION_STATUS_LABELS.approved, variant: 'approved' },
	published: { label: INVITATION_STATUS_LABELS.published, variant: 'published' },
};

export function resolveDisplayInfo(invitation: InvitationDTO): DisplayStatusInfo {
	if (invitation.archivedAt || invitation.status === 'archived') {
		return { label: INVITATION_STATUS_LABELS.archived, variant: 'archived', warning: null };
	}

	const rule = findMatchingRule(invitation);
	if (rule) return rule.getInfo(invitation);

	const display = STATUS_DISPLAY[invitation.status];
	if (display) {
		return { ...display, warning: null };
	}

	return { label: invitation.status, variant: 'generic', warning: null };
}

export function resolveRepairAction(invitation: InvitationDTO): RepairAction | null {
	const rule = findMatchingRule(invitation);
	return rule ? rule.getRepair(invitation) : null;
}

export function resolvePrimaryAction(invitation: InvitationDTO): PrimaryAction | null {
	const rule = findMatchingRule(invitation);
	if (rule) {
		return {
			text: 'Resolver inconsistencia',
			href: `/dashboard/invitaciones/${invitation.id}`,
		};
	}

	switch (invitation.status) {
		case 'draft':
			return {
				text: 'Editar datos base',
				href: invitation.internalEditUrl,
			};
		case 'waiting_for_client':
			return { text: 'Esperando respuesta del cliente' };
		case 'client_submitted':
			return {
				text: 'Revisar captura',
				href: `/dashboard/invitaciones/${invitation.id}/review`,
			};
		case 'in_review':
			return { text: 'En revisión' };
		case 'in_production':
			return {
				text: 'Administrar invitación',
				href: `/dashboard/invitaciones/${invitation.id}`,
			};
		case 'preview_sent':
			return { text: 'Esperando aprobación final' };
		case 'approved':
			return {
				text: 'Crear contenido',
				href: `/dashboard/invitaciones/${invitation.id}/draft`,
			};
		case 'published':
			return {
				text: 'Ver invitación pública',
				href: `/${invitation.eventType}/${getPublicSlug(invitation)}`,
			};
		case 'archived':
			return { text: 'Archivada' };
		default:
			return null;
	}
}
