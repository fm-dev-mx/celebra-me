import React, { useMemo, useState } from 'react';
import GuestMessageHistory from '@/components/dashboard/guests/GuestMessageHistory';
import {
	formatGuestMessageCount,
	parseGuestCommentHistory,
	resolveLabel,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestLastMessageProps {
	guestComment: string;
	fallbackTimestampIso?: string;
}

/** Latest guest message in two lines; the full history opens on request. */
const GuestLastMessage: React.FC<GuestLastMessageProps> = ({
	guestComment,
	fallbackTimestampIso,
}) => {
	const [expanded, setExpanded] = useState(false);
	const entries = useMemo(() => parseGuestCommentHistory(guestComment), [guestComment]);
	if (entries.length === 0) return null;

	if (expanded) {
		return (
			<div className="guest-last-message guest-last-message--expanded">
				<GuestMessageHistory
					guestComment={guestComment}
					fallbackTimestampIso={fallbackTimestampIso}
				/>
				<button
					type="button"
					className="guest-last-message__toggle"
					aria-expanded={true}
					onClick={() => setExpanded(false)}
				>
					Ver menos
				</button>
			</div>
		);
	}

	const latest = entries[0];
	return (
		<section className="guest-last-message" aria-label="Último mensaje del invitado">
			<h4 className="guest-last-message__title">
				Último mensaje · {resolveLabel(latest.timestampLabel, fallbackTimestampIso)}
			</h4>
			<p className="guest-last-message__text">«{latest.message}»</p>
			{entries.length > 1 && (
				<button
					type="button"
					className="guest-last-message__toggle"
					aria-expanded={false}
					onClick={() => setExpanded(true)}
				>
					Ver {formatGuestMessageCount(entries.length)}
				</button>
			)}
		</section>
	);
};

export default GuestLastMessage;
