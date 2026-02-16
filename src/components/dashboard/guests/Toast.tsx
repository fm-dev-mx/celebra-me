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
		<div className={`dashboard-toast dashboard-toast--${type}`}>
			<div className="dashboard-toast__content">
				<p>{message}</p>
				{action && (
					<button
						type="button"
						onClick={action.onClick}
						className="dashboard-toast__action"
					>
						{action.label}
					</button>
				)}
			</div>
			<button type="button" className="dashboard-toast__close" onClick={onClose}>
				×
			</button>
		</div>
	);
};

export default Toast;
