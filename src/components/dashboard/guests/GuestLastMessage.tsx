import React, { useId, useMemo, useState } from 'react';
import {
	formatGuestMessageCount,
	getGuestMessageDateLabel,
	parseGuestCommentHistory,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestLastMessageProps {
	guestComment: string;
	fallbackTimestampIso?: string;
}

/**
 * The guest's message, read like a note: the latest one always in full, earlier
 * ones below it on request. The toggle stays mounted so keyboard focus never jumps.
 * Shared by the detail sheet and the desktop table row.
 */
const GuestLastMessage: React.FC<GuestLastMessageProps> = ({
	guestComment,
	fallbackTimestampIso,
}) => {
	const titleId = useId();
	const olderId = useId();
	const [expanded, setExpanded] = useState(false);
	const entries = useMemo(() => parseGuestCommentHistory(guestComment), [guestComment]);
	if (entries.length === 0) return null;

	const [latest, ...older] = entries;
	const dateOf = (entry: (typeof entries)[number]) =>
		getGuestMessageDateLabel(entry, entries.length, fallbackTimestampIso);

	return (
		<section className="guest-last-message" aria-labelledby={titleId}>
			<h4 id={titleId} className="guest-last-message__title">
				{older.length > 0
					? `Mensaje del invitado · ${formatGuestMessageCount(entries.length)}`
					: 'Mensaje del invitado'}
			</h4>
			<blockquote className="guest-last-message__quote">
				<p className="guest-last-message__text">{latest.message}</p>
			</blockquote>
			<p className="guest-last-message__meta">{dateOf(latest)}</p>

			{older.length > 0 && (
				<>
					<button
						type="button"
						className="guest-last-message__toggle"
						aria-expanded={expanded}
						aria-controls={olderId}
						onClick={() => setExpanded((value) => !value)}
					>
						{expanded
							? 'Ocultar mensajes anteriores'
							: `Ver ${older.length === 1 ? 'mensaje anterior' : `${older.length} mensajes anteriores`}`}
					</button>
					<ol id={olderId} className="guest-last-message__older" hidden={!expanded}>
						{older.map((entry) => (
							<li key={entry.id} className="guest-last-message__older-item">
								<p className="guest-last-message__older-text">{entry.message}</p>
								<p className="guest-last-message__meta">{dateOf(entry)}</p>
							</li>
						))}
					</ol>
				</>
			)}
		</section>
	);
};

export default GuestLastMessage;
