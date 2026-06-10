import type { ShareMessageType } from '@/lib/rsvp/services/shared/invitation-helpers';

export interface MessageTypeInput {
	firstSharedAt: string | null;
	attendanceStatus?: string;
}

export function resolveDefaultMessageKind(input: MessageTypeInput): ShareMessageType {
	if (input.attendanceStatus === 'declined') return 'invitation';

	if (input.firstSharedAt) return 'reminder';

	return 'invitation';
}
