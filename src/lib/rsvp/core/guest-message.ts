const TIMESTAMP_RE = /^\[([^\]]+)\]\s+(.+)$/;

export type GuestMessageEntry = {
	id: string;
	message: string;
	timestampLabel?: string;
	isInitial: boolean;
};

export function parseGuestCommentHistory(guestComment: string): GuestMessageEntry[] {
	if (!guestComment?.trim()) return [];

	const raw = guestComment.split(/\n\n+/);
	const entries: GuestMessageEntry[] = [];

	for (const block of raw) {
		const trimmed = block.trim();
		if (!trimmed) continue;

		const match = trimmed.match(TIMESTAMP_RE);
		if (match) {
			entries.push({
				id: `msg-${entries.length}`,
				message: match[2].trim(),
				timestampLabel: match[1].trim(),
				isInitial: false,
			});
		} else {
			entries.push({
				id: `msg-${entries.length}`,
				message: trimmed,
				isInitial: true,
			});
		}
	}

	return entries.reverse();
}

export function formatMessageTimestamp(date: Date): string {
	const formatter = new Intl.DateTimeFormat('es-MX', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'America/Mexico_City',
		hourCycle: 'h23',
	});
	return formatter.format(date);
}

export function getLatestMessage(comment: string): string {
	const entries = parseGuestCommentHistory(comment);
	return entries.length > 0 ? entries[0].message : '';
}

export function appendGuestMessage(currentComment: string, newMessage: string, now?: Date): string {
	const trimmed = newMessage.trim();
	const existing = currentComment.trim();

	if (!existing) return trimmed;
	if (!trimmed) return currentComment;

	const latest = getLatestMessage(currentComment);
	if (latest === trimmed) return currentComment;

	const timestamp = formatMessageTimestamp(now ?? new Date());
	return `${existing}\n\n[${timestamp}] ${trimmed}`;
}
