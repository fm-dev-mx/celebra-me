import React, { useId, useMemo } from 'react';
import GuestStatusPill from '@/components/dashboard/guests/GuestStatusPill';
import {
	buildGuestMessageWall,
	formatGuestMessageCount,
} from '@/components/dashboard/guests/guest-presenter';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestMessageWallProps {
	items: DashboardGuestItem[];
	onOpenDetails: (item: DashboardGuestItem) => void;
}

/**
 * Every guest message in one place, read like signed notes, newest answer first.
 * Replaces the list under "Con mensaje"; the whole card opens the guest.
 */
const GuestMessageWall: React.FC<GuestMessageWallProps> = ({ items, onOpenDetails }) => {
	const titleId = useId();
	const entries = useMemo(() => buildGuestMessageWall(items), [items]);
	if (entries.length === 0) return null;

	return (
		<section className="guest-message-wall" aria-labelledby={titleId}>
			<header className="guest-message-wall__header">
				<h2 id={titleId} className="guest-message-wall__title">
					Mensajes de sus invitados
				</h2>
				<p className="guest-message-wall__hint">Del más reciente al más antiguo.</p>
			</header>

			<ol className="guest-message-wall__list">
				{entries.map(({ item, latest, timestampLabel, count }) => {
					const signatureId = `${titleId}-${item.guestId}`;
					return (
						<li key={item.guestId}>
							<article className="guest-message-card" aria-labelledby={signatureId}>
								<div className="guest-message-card__top">
									<GuestStatusPill item={item} />
									<p className="guest-message-card__meta">
										{timestampLabel}
										{count > 1 && ` · ${formatGuestMessageCount(count)}`}
									</p>
								</div>
								<figure className="guest-message-card__figure">
									<blockquote className="guest-message-card__quote">
										<p className="guest-message-card__text">{latest}</p>
									</blockquote>
									<figcaption
										id={signatureId}
										className="guest-message-card__signature"
									>
										{item.fullName}
									</figcaption>
								</figure>
								<button
									type="button"
									className="guest-message-card__open"
									aria-label={`Ver detalles de ${item.fullName}`}
									onClick={() => onOpenDetails(item)}
								>
									Ver detalles
								</button>
							</article>
						</li>
					);
				})}
			</ol>
		</section>
	);
};

export default GuestMessageWall;
