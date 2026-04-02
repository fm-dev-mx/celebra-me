import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface ToastProps {
	message: string;
	type?: 'info' | 'success' | 'warning';
	onClose: () => void;
	action?: {
		label: string;
		onClick: () => void;
	};
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, action }) => {
	const prefersReducedMotion = useReducedMotion();

	useEffect(() => {
		const timer = setTimeout(onClose, 5000);
		return () => clearTimeout(timer);
	}, [onClose]);

	const icon = type === 'success' ? 'OK' : type === 'warning' ? 'AV' : 'IN';

	return (
		<AnimatePresence>
			<motion.div
				initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={
					prefersReducedMotion
						? { opacity: 0 }
						: { opacity: 0, y: 10, transition: { duration: 0.18 } }
				}
				transition={
					prefersReducedMotion
						? { duration: 0 }
						: { type: 'spring', stiffness: 420, damping: 38, mass: 0.72 }
				}
				className={`dashboard-toast dashboard-toast--${type}`}
				role="status"
				aria-live="polite"
			>
				{/* Accent rail */}
				<div className="dashboard-toast__accent" aria-hidden="true" />

				{/* Icon */}
				<div className="dashboard-toast__icon-box" aria-hidden="true">
					<span>{icon}</span>
				</div>

				{/* Content */}
				<div className="dashboard-toast__content">
					<p>{message}</p>

					{action && (
						<motion.button
							whileHover={prefersReducedMotion ? undefined : { y: -1 }}
							whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
							type="button"
							onClick={action.onClick}
							className="dashboard-toast__action"
						>
							{action.label}
							<span aria-hidden="true">→</span>
						</motion.button>
					)}
				</div>

				{/* Close */}
				<motion.button
					type="button"
					className="dashboard-toast__close"
					onClick={onClose}
					aria-label="Cerrar notificación"
					whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
					whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
				>
					<span>×</span>
				</motion.button>
			</motion.div>
		</AnimatePresence>
	);
};

export default Toast;
