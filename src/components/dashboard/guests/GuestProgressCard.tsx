import React from 'react';
import { motion } from 'framer-motion';

interface GuestProgressCardProps {
	total: number;
	shared: number;
}

const GuestProgressCard: React.FC<GuestProgressCardProps> = ({ total, shared }) => {
	const percentage = total > 0 ? Math.round((shared / total) * 100) : 0;

	// Milestones for sparkle effect
	const showSparkle = percentage >= 50;
	const isComplete = percentage === 100;

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
						<strong>{shared}</strong> de {total} invitaciones compartidas
					</p>
					{!isComplete && total > 0 && (
						<p className="progress-next-action">
							💡 Tip: Usa "Enviar Siguiente" para avanzar rápido.
						</p>
					)}
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
					background: rgba(255, 255, 255, 0.05);
					backdrop-filter: blur(10px);
					border: 1px solid rgba(214, 199, 173, 0.2);
					border-radius: 16px;
					margin-bottom: 2rem;
					box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1);
				}
				.progress-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 1rem;
				}
				.progress-header h3 {
					font-size: 1rem;
					color: #d6c7ad;
					margin: 0;
					text-transform: uppercase;
					letter-spacing: 1px;
				}
				.progress-percentage {
					font-size: 1.5rem;
					font-weight: 700;
					color: #f5f5f5;
				}
				.progress-track {
					height: 12px;
					background: rgba(0, 0, 0, 0.2);
					border-radius: 6px;
					overflow: visible;
					position: relative;
					margin-bottom: 1rem;
				}
				.progress-fill {
					height: 100%;
					background: linear-gradient(90deg, #d6c7ad, #f5f5f5);
					border-radius: 6px;
					box-shadow: 0 0 10px rgba(214, 199, 173, 0.5);
				}
				.progress-sparkle {
					position: absolute;
					top: -10px;
					transform: translateX(-50%);
					font-size: 1.2rem;
					pointer-events: none;
				}
				.progress-footer {
					display: flex;
					justify-content: space-between;
					align-items: center;
					color: rgba(245, 245, 245, 0.7);
					font-size: 0.9rem;
				}
				.progress-footer p { margin: 0; }
				.completion-badge {
					color: #d6c7ad;
					font-weight: 600;
					background: rgba(214, 199, 173, 0.1);
					padding: 4px 8px;
					border-radius: 4px;
				}
			`}</style>
		</article>
	);
};

export default GuestProgressCard;
