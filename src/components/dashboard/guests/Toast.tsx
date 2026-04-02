import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface ToastProps {
	message: string;
	type?: 'info' | 'success' | 'warning';
	onClose: () => void;
}

const CheckIcon = () => (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="3"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M20 6 9 17l-5-5" />
	</svg>
);

const AlertIcon = () => (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="3"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<circle cx="12" cy="12" r="10" />
		<line x1="12" y1="8" x2="12" y2="12" />
		<line x1="12" y1="16" x2="12.01" y2="16" />
	</svg>
);

const InfoIcon = () => (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="3"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<circle cx="12" cy="12" r="10" />
		<line x1="12" y1="16" x2="12" y2="12" />
		<line x1="12" y1="8" x2="12.01" y2="8" />
	</svg>
);

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
	const prefersReducedMotion = useReducedMotion();

	useEffect(() => {
		const timer = setTimeout(onClose, 5000);
		return () => clearTimeout(timer);
	}, [onClose]);

	const Icon = type === 'success' ? CheckIcon : type === 'warning' ? AlertIcon : InfoIcon;

	return (
		<AnimatePresence>
			<motion.div
				initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
				animate={{ opacity: 1, y: 0 }}
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
				{/* Icon & Content */}
				<div className="dashboard-toast__body">
					<div className="dashboard-toast__icon">
						<Icon />
					</div>
					<div className="dashboard-toast__content">
						<p>{message}</p>
					</div>
				</div>

				{/* Close */}
				<button
					type="button"
					className="dashboard-toast__close"
					onClick={onClose}
					aria-label="Cerrar notificación"
				>
					<span>×</span>
				</button>
			</motion.div>
		</AnimatePresence>
	);
};

export default Toast;
