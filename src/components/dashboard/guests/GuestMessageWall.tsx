import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
	ChevronLeftGlyph,
	ChevronRightGlyph,
	MessageGlyph,
} from '@/components/dashboard/guests/GuestGlyphs';
import GuestStatusPill from '@/components/dashboard/guests/GuestStatusPill';
import {
	buildGuestMessageWall,
	getGuestListSubtitle,
	isNewGuestMessage,
	type GuestMessageWallEntry,
} from '@/components/dashboard/guests/guest-presenter';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestMessageWallProps {
	items: DashboardGuestItem[];
	onOpenDetails: (item: DashboardGuestItem) => void;
	/** Back to the full list. */
	onClose?: () => void;
	/** Last read of the wall; messages after it get a «Nuevo» tag. */
	seenAt?: number | null;
	/** Called once when the wall opens, to record the read. */
	onSeen?: () => void;
}

interface GuestMessageCardProps {
	entry: GuestMessageWallEntry;
	isNew: boolean;
	nameId: string;
	onOpenDetails: (item: DashboardGuestItem) => void;
}

interface MessageBubbleProps {
	text: string;
	time: string;
	tone?: 'latest' | 'earlier';
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ text, time, tone = 'latest' }) => (
	<div className={`guest-message-bubble guest-message-bubble--${tone}`}>
		<p className="guest-message-bubble__text">{text}</p>
		{time && <span className="guest-message-bubble__time">{time}</span>}
	</div>
);

const GuestMessageCard: React.FC<GuestMessageCardProps> = ({
	entry,
	isNew,
	nameId,
	onOpenDetails,
}) => {
	const { item, latest, timestampLabel, earlier } = entry;
	const [showEarlier, setShowEarlier] = useState(false);
	const earlierId = `${nameId}-earlier`;
	// Oldest first, like a chat thread, so the latest message stays at the bottom.
	const thread = [...earlier].reverse();

	return (
		<article
			className={`guest-message-card${isNew ? ' guest-message-card--new' : ''}`}
			aria-labelledby={nameId}
		>
			<header className="guest-message-card__head">
				<span className="guest-message-card__avatar" aria-hidden="true">
					<MessageGlyph size={16} />
				</span>
				<div className="guest-message-card__who">
					<h3 id={nameId} className="guest-message-card__name">
						<button
							type="button"
							className="guest-message-card__open"
							aria-label={`Ver invitado: ${item.fullName}`}
							onClick={() => onOpenDetails(item)}
						>
							{item.fullName}
						</button>
					</h3>
					<p className="guest-message-card__context">
						<GuestStatusPill item={item} />
						<span>{getGuestListSubtitle(item)}</span>
					</p>
				</div>
				<ChevronRightGlyph size={16} />
			</header>

			<div className="guest-message-card__chat">
				{earlier.length > 0 && (
					<button
						type="button"
						className="guest-message-card__earlier-toggle"
						aria-expanded={showEarlier}
						aria-controls={earlierId}
						onClick={() => setShowEarlier(!showEarlier)}
					>
						{showEarlier
							? 'Ocultar mensajes anteriores'
							: `Ver ${earlier.length === 1 ? '1 mensaje anterior' : `${earlier.length} mensajes anteriores`}`}
					</button>
				)}
				{showEarlier && (
					<ol id={earlierId} className="guest-message-card__earlier-list">
						{thread.map((message) => (
							<li key={message.id}>
								<MessageBubble
									text={message.message}
									time={message.timestampLabel}
									tone="earlier"
								/>
							</li>
						))}
					</ol>
				)}
				{isNew && <p className="guest-message-card__unread">Mensaje nuevo</p>}
				<MessageBubble text={latest} time={timestampLabel} />
			</div>
		</article>
	);
};

/**
 * Every guest message in one place, newest answer first: who wrote, what they
 * said, and how their invitation stands. Replaces the list
 * under "Con mensaje" and scrolls into view when it opens. Messages that came
 * after the host's last read are tagged; the read is recorded on open.
 */
const GuestMessageWall: React.FC<GuestMessageWallProps> = ({
	items,
	onOpenDetails,
	onClose,
	seenAt = null,
	onSeen,
}) => {
	const titleId = useId();
	const sectionRef = useRef<HTMLElement>(null);
	const entries = useMemo(() => buildGuestMessageWall(items), [items]);
	// Keep the tags while the wall stays open, even after the read is recorded.
	const [openedSeenAt] = useState(seenAt);
	const onSeenRef = useRef(onSeen);

	useEffect(() => {
		sectionRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
		onSeenRef.current?.();
	}, []);

	return (
		<section ref={sectionRef} className="guest-message-wall" aria-labelledby={titleId}>
			<header className="guest-message-wall__header">
				{onClose && (
					<button type="button" className="guest-message-wall__back" onClick={onClose}>
						<ChevronLeftGlyph size={18} />
						<span>Volver a la lista</span>
					</button>
				)}
				<h2 id={titleId} className="guest-message-wall__title">
					Mensajes de sus invitados
					{entries.length > 0 && (
						<span className="guest-message-wall__count"> ({entries.length})</span>
					)}
				</h2>
			</header>

			{entries.length === 0 ? (
				<p className="guest-message-wall__empty">
					Ningún mensaje coincide con su búsqueda.
				</p>
			) : (
				<ol className="guest-message-wall__list">
					{entries.map((entry) => (
						<li key={entry.item.guestId}>
							<GuestMessageCard
								entry={entry}
								isNew={isNewGuestMessage(entry, openedSeenAt)}
								nameId={`${titleId}-${entry.item.guestId}`}
								onOpenDetails={onOpenDetails}
							/>
						</li>
					))}
				</ol>
			)}
		</section>
	);
};

export default GuestMessageWall;
