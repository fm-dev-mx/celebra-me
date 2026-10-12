import React, { useLayoutEffect, useRef } from 'react';
import {
	formatEngagementDuration,
	formatGuestDateShort,
} from '@/components/dashboard/guests/guest-presenter';
import type { DashboardEngagementSummary } from '@/interfaces/dashboard/guest.interface';

interface GuestEngagementFunnelProps {
	/** Absent or null when the summary is unavailable; the funnel then renders nothing. */
	summary?: DashboardEngagementSummary | null;
}

/** Bar width goes through a CSS variable because inline styles are not allowed. */
const FunnelBar: React.FC<{ percent: number }> = ({ percent }) => {
	const ref = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		ref.current?.style.setProperty('--engagement-share', `${percent}%`);
	}, [percent]);
	return <span ref={ref} className="guest-engagement__bar" aria-hidden="true" />;
};

/**
 * Guest engagement funnel (metrics dictionary: docs/domains/rsvp/engagement-analytics.md).
 * Each step counts only guests counted in every previous step; percentages are of sent invitations.
 */
const GuestEngagementFunnel: React.FC<GuestEngagementFunnelProps> = ({ summary }) => {
	if (!summary || summary.shared === 0) return null;

	const steps = [
		{ key: 'shared', label: 'Enviadas', count: summary.shared },
		{ key: 'opened', label: 'Abiertas', count: summary.opened },
		{ key: 'form-viewed', label: 'Llegaron al formulario', count: summary.formViewed },
		{ key: 'form-started', label: 'Empezaron a responder', count: summary.formStarted },
		{ key: 'responded', label: 'Respondieron', count: summary.responded },
	];
	const notes: string[] = [];
	if (summary.previewed > 0) {
		notes.push(
			summary.previewed === 1
				? '1 invitación se mostró como vista previa en el chat.'
				: `${summary.previewed} invitaciones se mostraron como vista previa en el chat.`,
		);
	}
	if (summary.medianSecondsToOpen !== null) {
		notes.push(
			`La mitad de sus invitados abre en menos de ${formatEngagementDuration(summary.medianSecondsToOpen)} después del envío.`,
		);
	}

	return (
		<section className="guest-engagement" aria-labelledby="guest-engagement-heading">
			<h3 id="guest-engagement-heading" className="guest-engagement__heading">
				Interacción de sus invitados
			</h3>
			<ol className="guest-engagement__steps">
				{steps.map((step) => {
					const percent = Math.round((step.count / summary.shared) * 100);
					return (
						<li key={step.key} className="guest-engagement__step">
							<span className="guest-engagement__label">{step.label}</span>
							<FunnelBar percent={percent} />
							<span className="guest-engagement__value">
								<strong>{step.count}</strong> · {percent} %
							</span>
						</li>
					);
				})}
			</ol>
			{notes.map((note) => (
				<p key={note} className="guest-engagement__note">
					{note}
				</p>
			))}
			{summary.trackingStartedAt && (
				<p className="guest-engagement__since">
					Datos desde el {formatGuestDateShort(summary.trackingStartedAt)}. No incluye
					invitados de prueba.
				</p>
			)}
		</section>
	);
};

export default GuestEngagementFunnel;
