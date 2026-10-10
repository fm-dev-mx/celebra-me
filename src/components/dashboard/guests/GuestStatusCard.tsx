import React from 'react';
import GuestStatusPill from '@/components/dashboard/guests/GuestStatusPill';
import {
	getGuestProgressSteps,
	getGuestStatusSentence,
} from '@/components/dashboard/guests/guest-presenter';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

const STEP_STATE_LABEL = {
	done: 'hecho',
	current: 'en curso',
	upcoming: 'pendiente',
} as const;

/** Where the invitation stands: status, the three steps in one row and one sentence. */
const GuestStatusCard: React.FC<{ item: DashboardGuestItem }> = ({ item }) => {
	const steps = getGuestProgressSteps(item);

	return (
		<section className="guest-status-card" aria-label="Estado de la invitación">
			<GuestStatusPill item={item} />
			<ol className="guest-status-card__steps" aria-label="Avance">
				{steps.map((step) => (
					<li
						key={step.label}
						className={`guest-status-card__step guest-status-card__step--${step.state}`}
					>
						<span className="guest-status-card__bar" aria-hidden="true" />
						<span className="guest-status-card__label">
							{step.label}
							<span className="sr-only">: {STEP_STATE_LABEL[step.state]}</span>
						</span>
						{step.note && <span className="guest-status-card__note">{step.note}</span>}
					</li>
				))}
			</ol>
			<p className="guest-status-card__sentence">{getGuestStatusSentence(item)}</p>
		</section>
	);
};

export default GuestStatusCard;
