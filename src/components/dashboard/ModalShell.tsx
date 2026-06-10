import React from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';

interface ModalShellProps {
	title: string;
	subtitle?: React.ReactNode;
	className?: string;
	onClose: () => void;
	children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({
	title,
	subtitle,
	className,
	onClose,
	children,
}) => (
	<DashboardModalPortal>
		<div
			className="dashboard-modal-backdrop"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className={`dashboard-modal${className ? ` ${className}` : ''}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="dashboard-modal-title"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="dashboard-modal__header">
					<div className="dashboard-modal__header-content">
						<h3 id="dashboard-modal-title">{title}</h3>
						{subtitle && <p className="dashboard-modal__subtitle">{subtitle}</p>}
					</div>
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
