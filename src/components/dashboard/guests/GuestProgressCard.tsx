import React from 'react';
import { motion } from 'framer-motion';

interface GuestProgressCardProps {
	totalPeople: number;
	confirmedPeople: number;
	sessionCount: number;
}

const GuestProgressCard: React.FC<GuestProgressCardProps> = ({
	totalPeople,
	confirmedPeople,
	sessionCount,
}) => {
	const total = totalPeople;
	const shared = confirmedPeople;
	const percentage = total > 0 ? Math.round((shared / total) * 100) : 0;

	// Milestones for sparkle effect
	const showSparkle = percentage >= 50;
	const isComplete = percentage === 100;

	// Session goal constant
	const SESSION_GOAL = 10;
	const sessionPercentage = Math.min((sessionCount / SESSION_GOAL) * 100, 100);

	return (
		<article className="dashboard-guests__progress-card">
			<div className="progress-header">
				<h3>Progreso de Envío</h3>
				<span className="progress-percentage">{percentage}%</span>
			</div>

			<div className="progress-track">
				<motion.div
					className="progress-fill"
					initial={{ width: 0 }}
					animate={{ width: `${percentage}%` }}
					transition={{ duration: 1, ease: 'easeOut' }}
				/>
				{showSparkle && (
					<motion.div
						className="progress-sparkle"
						animate={{
							opacity: [0, 1, 0],
							scale: [0.8, 1.2, 0.8],
							left: `${percentage}%`,
						}}
						transition={{ duration: 2, repeat: Infinity }}
					>
						✨
					</motion.div>
				)}
			</div>

			<div className="progress-footer">
				<div className="progress-footer__info">
					<p>
						<strong>{shared}</strong> de {total} invitados confirmados
					</p>

					{/* Session Progress Tracker */}
					<div className="session-progress">
						<span className="session-progress__label">Meta de la sesión</span>
						<div className="session-progress__bar-container">
							<motion.div
								className="session-progress__bar"
								initial={{ width: 0 }}
								animate={{ width: `${sessionPercentage}%` }}
								transition={{ duration: 0.8, ease: 'easeOut' }}
							/>
						</div>
						<span className="session-progress__count">
							{sessionCount} / {SESSION_GOAL} compartidos ahora
						</span>
					</div>
				</div>
				{isComplete && (
					<motion.span
						className="completion-badge"
						initial={{ scale: 0 }}
						animate={{ scale: 1 }}
						transition={{ type: 'spring', stiffness: 200, damping: 10 }}
					>
						🏆 ¡Todo enviado!
					</motion.span>
				)}
			</div>
		</article>
	);
};

export default GuestProgressCard;
