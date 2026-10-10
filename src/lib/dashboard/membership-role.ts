import type { UserAssignedEventDTO } from '@/lib/dashboard/dto/users';

export type EventMembershipRole = UserAssignedEventDTO['membershipRole'];

/** Visible names for event membership roles; only the main host sees guest memories. */
export const EVENT_MEMBERSHIP_ROLE_LABEL: Record<EventMembershipRole, string> = {
	owner: 'Anfitrión principal',
	manager: 'Colaborador',
};

/** Role preselected when an administrator assigns an event to a user. */
export const DEFAULT_ASSIGNED_MEMBERSHIP_ROLE: EventMembershipRole = 'owner';

export const EVENT_MEMBERSHIP_ROLE_HINT =
	'Solo el anfitrión principal ve Recuerdos; el colaborador gestiona invitados.';
