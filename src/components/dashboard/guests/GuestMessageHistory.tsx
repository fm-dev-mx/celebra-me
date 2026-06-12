import React, { useMemo } from 'react';
import {
	formatGuestMessageCount,
	parseGuestCommentHistory,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestMessageHistoryProps {
	guestComment: string;
}

const GuestMessageHistory: React.FC<GuestMessageHistoryProps> = ({ guestComment }) => {
	const entries = useMemo(() => parseGuestCommentHistory(guestComment), [guestComment]);
	if (entries.length === 0) return null;

	return (
		<section className="guest-message-history" aria-label="Mensajes del invitado">
			<header className="guest-message-history__header">
				<span className="guest-message-history__title">Mensajes del invitado</span>
				<span className="guest-message-history__count">
					{formatGuestMessageCount(entries.length)}
				</span>
			</header>

			<ol className="guest-message-history__list">
				{entries.map((entry, idx) => (
					<li
						key={entry.id}
						className={`guest-message-history__item${idx === 0 ? ' guest-message-history__item--latest' : ''}`}
					>
						<p className="guest-message-history__text">{entry.message}</p>
						<p className="guest-message-history__meta">
							{entry.timestampLabel ?? 'Mensaje inicial'}
						</p>
					</li>
				))}
			</ol>
		</section>
	);
};

export default GuestMessageHistory;
