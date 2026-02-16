import React, { useEffect } from 'react';

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

	return (
		<div
			className={`dashboard-toast dashboard-toast--${type}`}
			style={{
				background: 'rgba(25, 25, 25, 0.85)',
				backdropFilter: 'blur(12px)',
				border: '1px solid rgba(214, 199, 173, 0.3)',
				borderRadius: '12px',
				padding: '1rem 1.5rem',
				color: '#f5f5f5',
				boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(214, 199, 173, 0.1)',
				display: 'flex',
				alignItems: 'center',
				gap: '1rem',
				minWidth: '300px',
				fontFamily: "'Montserrat', sans-serif",
			}}
		>
			<div className="dashboard-toast__content" style={{ flex: 1 }}>
				<p style={{ margin: 0, fontSize: '0.95rem' }}>{message}</p>
				{action && (
					<button
						type="button"
						onClick={action.onClick}
						className="dashboard-toast__action"
						style={{
							marginTop: '0.5rem',
							background: 'rgba(214, 199, 173, 0.2)',
							border: '1px solid #d6c7ad',
							color: '#d6c7ad',
							padding: '4px 12px',
							borderRadius: '4px',
							cursor: 'pointer',
							fontSize: '0.85rem',
						}}
					>
						{action.label}
					</button>
				)}
			</div>
			<button
				type="button"
				className="dashboard-toast__close"
				onClick={onClose}
				style={{
					background: 'none',
					border: 'none',
					color: 'rgba(245, 245, 245, 0.5)',
					fontSize: '1.5rem',
					cursor: 'pointer',
					lineHeight: 1,
				}}
			>
				×
			</button>
		</div>
	);
};

export default Toast;
