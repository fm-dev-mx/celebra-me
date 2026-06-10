import type { ShareMessageType } from '@/lib/rsvp/services/shared/invitation-helpers';

export interface MessageTypeInput {
	firstSharedAt: string | null;
	attendanceStatus?: string;
	deliveryStatus?: string;
}

export function resolveDefaultMessageKind(input: MessageTypeInput): ShareMessageType {
	if (input.attendanceStatus === 'declined') return 'invitation';

	if (input.deliveryStatus === 'generated') return 'invitation';
	if (input.deliveryStatus === 'shared') return 'reminder';

	if (input.firstSharedAt) return 'reminder';

	return 'invitation';
}
