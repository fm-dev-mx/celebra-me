import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
	useEffect(() => {
		const timer = setTimeout(onClose, 5000);
		return () => clearTimeout(timer);
	}, [onClose]);

	const icon = type === 'success' ? '✨' : type === 'warning' ? '⚠️' : 'ℹ️';

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, y: 24, scale: 0.98 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.18 } }}
				transition={{ type: 'spring', stiffness: 520, damping: 36, mass: 0.7 }}
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
							whileHover={{ y: -1 }}
							whileTap={{ scale: 0.98 }}
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
					whileHover={{ scale: 1.06 }}
					whileTap={{ scale: 0.95 }}
				>
					<span>×</span>
				</motion.button>
			</motion.div>
		</AnimatePresence>
	);
};

export default Toast;
