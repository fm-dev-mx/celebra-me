import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface GuestProgressCardProps {
	totalInvitations: number;
	sharedInvitations: number;
	confirmedInvitations: number;
	declinedInvitations: number;
	sessionSharedCount: number;
}

const GuestProgressCard: React.FC<GuestProgressCardProps> = ({
	totalInvitations,
	sharedInvitations,
	confirmedInvitations,
	declinedInvitations,
	sessionSharedCount,
}) => {
	const prefersReducedMotion = useReducedMotion();
	const deliveryPercentage =
		totalInvitations > 0 ? Math.round((sharedInvitations / totalInvitations) * 100) : 0;
	const respondedInvitations = confirmedInvitations + declinedInvitations;
	const responsePercentage =
		totalInvitations > 0 ? Math.round((respondedInvitations / totalInvitations) * 100) : 0;
	const isDeliveryComplete = totalInvitations > 0 && sharedInvitations === totalInvitations;
	const sessionLabel =
		sessionSharedCount > 0
			? `${sessionSharedCount} entrega${sessionSharedCount === 1 ? '' : 's'} registrada${sessionSharedCount === 1 ? '' : 's'}`
			: 'Sin entregas registradas en esta sesión';

	return (
		<article className="dashboard-guests__progress-card">
			<div className="progress-header">
				<div>
					<h3>Entrega de invitaciones</h3>
					<p className="progress-kicker">Seguimiento editorial de envíos y respuestas</p>
				</div>
				<span className="progress-percentage">{deliveryPercentage}%</span>
			</div>

			<div
				className="progress-track"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={deliveryPercentage}
				aria-label="Progreso de invitaciones entregadas"
			>
				<motion.div
					className="progress-fill"
					initial={prefersReducedMotion ? false : { width: 0 }}
					animate={{ width: `${deliveryPercentage}%` }}
					transition={
						prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: 'easeOut' }
					}
				/>
			</div>

			<div className="progress-footer">
				<div className="progress-footer__info">
					<p>
						<strong>{sharedInvitations}</strong> de {totalInvitations} invitaciones
						entregadas
					</p>
					<p className="progress-footer__secondary">
						<strong>{respondedInvitations}</strong> respuestas registradas (
						{responsePercentage}
						%)
					</p>
				</div>

				<div className="session-progress">
					<span className="session-progress__label">Sesión actual</span>
					<div className="session-progress__bar-container" aria-hidden="true">
						<motion.div
							className="session-progress__bar"
							initial={prefersReducedMotion ? false : { width: 0 }}
							animate={{
								width: `${Math.min(
									sharedInvitations > 0
										? (sessionSharedCount / Math.max(sharedInvitations, 1)) *
												100
										: 0,
									100,
								)}%`,
							}}
							transition={
								prefersReducedMotion
									? { duration: 0 }
									: { duration: 0.6, ease: 'easeOut' }
							}
						/>
					</div>
					<span className="session-progress__count">{sessionLabel}</span>
				</div>
			</div>

			{isDeliveryComplete && (
				<motion.span
					className="completion-badge"
					initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35 }}
				>
					Entrega completa
				</motion.span>
			)}
		</article>
	);
};

export default GuestProgressCard;
