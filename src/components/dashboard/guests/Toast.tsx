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
				initial={{ opacity: 0, y: 50, scale: 0.9 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
				className={`dashboard-toast dashboard-toast--${type}`}
				style={{
					position: 'fixed',
					bottom: '2rem',
					right: '2rem',
					background: 'rgba(25, 25, 25, 0.8)',
					backdropFilter: 'blur(16px) saturate(180%)',
					WebkitBackdropFilter: 'blur(16px) saturate(180%)',
					border: '1px solid rgba(214, 199, 173, 0.3)',
					borderRadius: '16px',
					padding: '1.25rem 2rem',
					color: '#f5f5f5',
					boxShadow:
						'0 12px 40px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(214, 199, 173, 0.1)',
					display: 'flex',
					alignItems: 'center',
					gap: '1.25rem',
					minWidth: '320px',
					zIndex: 1100,
					fontFamily: "'Cinzel', serif",
				}}
			>
				<div style={{ fontSize: '1.5rem' }}>{icon}</div>
				<div className="dashboard-toast__content" style={{ flex: 1 }}>
					<p style={{ margin: 0, fontSize: '1rem', letterSpacing: '0.02em' }}>
						{message}
					</p>
					{action && (
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							type="button"
							onClick={action.onClick}
							className="dashboard-toast__action"
							style={{
								marginTop: '0.75rem',
								background:
									'linear-gradient(135deg, rgba(214, 199, 173, 0.3), rgba(214, 199, 173, 0.1))',
								border: '1px solid #d6c7ad',
								color: '#d6c7ad',
								padding: '6px 16px',
								borderRadius: '8px',
								cursor: 'pointer',
								fontSize: '0.8rem',
								fontWeight: 600,
								textTransform: 'uppercase',
								letterSpacing: '0.1em',
							}}
						>
							{action.label}
						</motion.button>
					)}
				</div>
				<button
					type="button"
					className="dashboard-toast__close"
					onClick={onClose}
					style={{
						background: 'none',
						border: 'none',
						color: 'rgba(245, 245, 245, 0.4)',
						fontSize: '1.75rem',
						cursor: 'pointer',
						lineHeight: 1,
						transition: 'color 0.2s ease',
					}}
					onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
					onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(245, 245, 245, 0.4)')}
				>
					×
				</button>
			</motion.div>
		</AnimatePresence>
	);
};

export default Toast;
