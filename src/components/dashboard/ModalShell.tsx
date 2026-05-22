import React from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';

interface ModalShellProps {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({ title, onClose, children }) => (
	<DashboardModalPortal>
		<div
			className="dashboard-modal-backdrop"
			role="dialog"
			aria-modal="true"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
				<div className="dashboard-modal__header">
					<h3>{title}</h3>
					<button
						type="button"
						className="btn-close"
						onClick={onClose}
						aria-label="Cerrar modal"
					>
						✕
					</button>
				</div>
				{children}
			</div>
		</div>
	</DashboardModalPortal>
);

export default ModalShell;
