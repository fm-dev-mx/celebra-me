import React from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';

interface EventConfirmDialogProps {
	open: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	variant?: 'primary' | 'danger';
	onCancel: () => void;
	onConfirm: () => Promise<void>;
}

const EventConfirmDialog: React.FC<EventConfirmDialogProps> = ({
	open,
	title,
	message,
	confirmLabel,
	variant = 'primary',
	onCancel,
	onConfirm,
}) => {
	if (!open) {
		return null;
	}

	return (
		<DashboardModalPortal>
			<div
				className="dashboard-modal-backdrop"
				role="dialog"
				aria-modal="true"
				onClick={onCancel}
			>
				<div className="dashboard-modal" onClick={(event) => event.stopPropagation()}>
					<h3>{title}</h3>
					<p className="dashboard-confirm-message">{message}</p>
					<div className="dashboard-modal__actions">
						<button type="button" className="btn-secondary" onClick={onCancel}>
							Cancelar
						</button>
						<button
							type="button"
							className={`btn-primary ${variant === 'danger' ? 'btn-primary--danger' : ''}`}
							onClick={() => {
								void onConfirm();
							}}
						>
							{confirmLabel || 'Confirmar'}
						</button>
					</div>
				</div>
			</div>
		</DashboardModalPortal>
	);
};

export default EventConfirmDialog;
