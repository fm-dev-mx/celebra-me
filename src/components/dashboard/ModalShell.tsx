import React from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';

interface ModalShellProps {
	title: string;
	subtitle?: React.ReactNode;
	className?: string;
	onClose: () => void;
	children: React.ReactNode;
	variant?: 'default' | 'confirm';
	size?: 'sm' | 'md' | 'lg';
	fullscreenOnMobile?: boolean;
	footer?: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({
	title,
	subtitle,
	className,
	onClose,
	children,
	variant = 'default',
	size = 'md',
	fullscreenOnMobile = true,
	footer,
}) => {
	let modalClass = 'dashboard-modal';
	if (variant === 'confirm') modalClass += ' dashboard-modal--confirm';
	if (size === 'lg') modalClass += ' dashboard-modal--full';
	if (!fullscreenOnMobile) modalClass += ' dashboard-modal--not-fullscreen';
	if (className) modalClass += ' ' + className;

	return (
		<DashboardModalPortal>
			<div
				className="dashboard-modal-backdrop"
				onClick={(e) => {
					if (e.target === e.currentTarget) onClose();
				}}
			>
				<div
					className={modalClass}
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
					{footer && <div className="dashboard-modal__footer">{footer}</div>}
				</div>
			</div>
		</DashboardModalPortal>
	);
};

export default ModalShell;
