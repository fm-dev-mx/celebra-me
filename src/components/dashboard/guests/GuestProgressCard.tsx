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
	const shared = confirmedPeople; // Using confirmed as "progress" for now or keep it as invitations shared?
	// User said: "en total y pendientes muestre dentro de la misma card: En número grande el número de invitados y en número chico el numero de invitaciones"
	// Wait, GuestProgressCard is different from GuestStatsCards.
	// Let's stick to the implementation plan: GuestProgressCard will show people progress.
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
							<div
								className="session-progress__bar"
								style={{ width: `${sessionPercentage}%` }}
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

			<style>{`
				.dashboard-guests__progress-card {
					padding: 1.5rem;
					background: rgba(white, 0.03);
					backdrop-filter: blur(12px);
					border: 1px solid rgba(214, 199, 173, 0.15);
					border-radius: 20px;
					margin-bottom: 2.5rem;
					box-shadow: $shadow-premium;
					width: 100%;
					box-sizing: border-box;
					position: relative;
				}
				@media (max-width: 480px) {
					.dashboard-guests__progress-card {
						padding: 1.25rem 1rem;
					}
				}
				.progress-header {
					display: flex;
					gap: 1rem;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 1.5rem;
					flex-wrap: wrap;
				}
				.progress-header h3 {
					font-size: 0.85rem;
					color: #d6c7ad;
					margin: 0;
					text-transform: uppercase;
					letter-spacing: 0.2em;
					font-weight: 700;
				}
				.progress-percentage {
					font-size: 1.75rem;
					font-weight: 800;
					color: #f5f5f5;
					font-family: 'Playfair Display', serif;
				}
				.progress-track {
					height: 8px;
					background: rgba(0, 0, 0, 0.3);
					border-radius: 100px;
					overflow: visible;
					position: relative;
					margin-bottom: 1.5rem;
				}
				.progress-fill {
					height: 100%;
					background: linear-gradient(90deg, #d6c7ad, #f5f5f5, #d6c7ad);
					background-size: 200% 100%;
					animation: shimmer 3s infinite linear;
					border-radius: 100px;
					box-shadow: 0 0 15px rgba(214, 199, 173, 0.4);
				}
				@keyframes shimmer {
					0% { background-position: 0% 0%; }
					100% { background-position: -200% 0%; }
				}
				.progress-sparkle {
					position: absolute;
					top: -10px;
					transform: translateX(-50%);
					font-size: 1.2rem;
					pointer-events: none;
					text-shadow: 0 0 10px #d6c7ad;
				}
				.progress-footer {
					display: flex;
					flex-direction: column;
					gap: 1.5rem;
					color: rgba(245, 245, 245, 0.7);
					font-size: 0.9rem;
				}
				.progress-footer p {
					margin: 0;
					word-break: break-word;
					font-family: inherit;
				}
				.session-progress {
					background: rgba(0, 0, 0, 0.15);
					padding: 1rem;
					border-radius: 12px;
				}
				.session-progress__label {
					font-size: 0.7rem;
					text-transform: uppercase;
					letter-spacing: 0.1em;
					margin-bottom: 0.5rem;
					display: block;
				}
				.session-progress__bar-container {
					height: 4px;
					background: rgba(255, 255, 255, 0.05);
					border-radius: 2px;
					margin: 0.5rem 0;
				}
				.session-progress__bar {
					height: 100%;
					background: #d6c7ad;
					border-radius: 2px;
					transition: width 0.5s ease;
				}
				.completion-badge {
					align-self: flex-start;
					color: #d6c7ad;
					font-weight: 700;
					background: rgba(214, 199, 173, 0.15);
					padding: 6px 12px;
					border-radius: 100px;
					border: 1px solid rgba(214, 199, 173, 0.3);
					font-size: 0.8rem;
					display: flex;
					align-items: center;
					gap: 0.5rem;
				}
				@media (min-width: 640px) {
					.progress-footer {
						flex-direction: row;
						justify-content: space-between;
						align-items: flex-end;
					}
					.progress-header h3 { font-size: 1rem; }
					.progress-percentage { font-size: 2.25rem; }
				}
			`}</style>
		</article>
	);
};

export default GuestProgressCard;
