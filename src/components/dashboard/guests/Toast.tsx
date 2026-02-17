import React, { useEffect, useMemo } from 'react';
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

	const accent = useMemo(() => {
		// Keep your gold identity, but tune per type with subtle differences
		if (type === 'success') return 'rgba(214, 199, 173, 0.95)';
		if (type === 'warning') return 'rgba(255, 203, 92, 0.95)';
		return 'rgba(214, 199, 173, 0.85)';
	}, [type]);

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
				style={{
					position: 'fixed',
					bottom: '6rem',
					right: '0.5rem',
					zIndex: 1100,

					// Glass body
					background:
						'radial-gradient(140% 140% at 10% 0%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 35%, rgba(0,0,0,0.18) 100%), rgba(12, 12, 12, 0.72)',
					backdropFilter: 'blur(18px) saturate(170%)',
					WebkitBackdropFilter: 'blur(18px) saturate(170%)',

					// Border + subtle “frame”
					border: `1px solid rgba(214, 199, 173, 0.22)`,
					boxShadow:
						'0 14px 46px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(0,0,0,0.35)',
					borderRadius: '18px',

					// Layout
					minWidth: '320px',
					maxWidth: '420px',
					padding: '1.1rem 1.25rem',
					display: 'flex',
					alignItems: 'flex-start',
					gap: '0.9rem',

					color: 'rgba(245,245,245,0.92)',
					fontFamily: "'Cinzel', serif",
				}}
			>
				{/* Accent rail */}
				<div
					aria-hidden="true"
					style={{
						width: '10px',
						alignSelf: 'stretch',
						borderRadius: '999px',
						background: `linear-gradient(180deg, ${accent} 0%, rgba(214, 199, 173, 0.10) 100%)`,
						boxShadow:
							'inset 0 0 0 1px rgba(255,255,255,0.10), 0 0 0 1px rgba(0,0,0,0.25)',
						opacity: 0.9,
					}}
				/>

				{/* Icon */}
				<div
					style={{
						width: '34px',
						height: '34px',
						borderRadius: '12px',
						display: 'grid',
						placeItems: 'center',
						background:
							'radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.12) 100%)',
						border: '1px solid rgba(255,255,255,0.08)',
						boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
						flex: '0 0 auto',
					}}
					aria-hidden="true"
				>
					<span style={{ fontSize: '1.15rem' }}>{icon}</span>
				</div>

				{/* Content */}
				<div
					className="dashboard-toast__content"
					style={{ flex: 1, paddingTop: '0.05rem' }}
				>
					<p
						style={{
							margin: 0,
							fontSize: '0.98rem',
							letterSpacing: '0.02em',
							lineHeight: 1.25,
							color: 'rgba(245,245,245,0.92)',
						}}
					>
						{message}
					</p>

					{action && (
						<motion.button
							whileHover={{ y: -1 }}
							whileTap={{ scale: 0.98 }}
							type="button"
							onClick={action.onClick}
							className="dashboard-toast__action"
							style={{
								marginTop: '0.75rem',
								display: 'inline-flex',
								alignItems: 'center',
								gap: '0.5rem',

								background:
									'radial-gradient(120% 120% at 30% 20%, rgba(214,199,173,0.22) 0%, rgba(214,199,173,0.10) 55%, rgba(0,0,0,0.08) 100%)',
								border: '1px solid rgba(214, 199, 173, 0.55)',
								color: 'rgba(214, 199, 173, 0.98)',
								padding: '8px 14px',
								borderRadius: '12px',
								cursor: 'pointer',

								fontSize: '0.78rem',
								fontWeight: 650,
								textTransform: 'uppercase',
								letterSpacing: '0.12em',

								boxShadow:
									'inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 24px rgba(0,0,0,0.25)',
							}}
						>
							{action.label}
							<span aria-hidden="true" style={{ opacity: 0.7 }}>
								→
							</span>
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
					style={{
						background: 'transparent',
						border: '1px solid rgba(255,255,255,0.10)',
						borderRadius: '12px',
						width: '24px',
						height: '24px',
						display: 'grid',
						placeItems: 'center',
						cursor: 'pointer',
						color: 'rgba(245,245,245,0.65)',
						boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
						flex: '0 0 auto',
					}}
				>
					<span style={{ fontSize: '1.15rem', lineHeight: 1 }}>×</span>
				</motion.button>
			</motion.div>
		</AnimatePresence>
	);
};

export default Toast;
