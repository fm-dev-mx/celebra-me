import React from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestDeleteConfirmModalProps {
	guestToDelete: DashboardGuestItem | null;
	onClose: () => void;
	onConfirm: () => Promise<void>;
}

const GuestDeleteConfirmModal: React.FC<GuestDeleteConfirmModalProps> = ({
	guestToDelete,
	onClose,
	onConfirm,
}) => {
	if (!guestToDelete) return null;

	return (
		<ModalShell
			title="Confirmar eliminación"
			variant="confirm"
			onClose={onClose}
			footer={
				<>
					<button type="button" className="btn-secondary" onClick={onClose}>
						Cancelar
					</button>
					<button
						type="button"
						className="btn-primary btn-primary--danger"
						onClick={() => {
							void onConfirm();
						}}
					>
						Eliminar definitivamente
					</button>
				</>
			}
		>
			<div className="dashboard-modal__content">
				<p className="dashboard-modal__confirm-text">
					¿Estás seguro de que deseas eliminar a <strong>{guestToDelete.fullName}</strong>
					?
				</p>

				<p className="dashboard-modal__confirm-warning">
					Esta acción no se puede deshacer.
				</p>
			</div>
		</ModalShell>
	);
};

export default GuestDeleteConfirmModal;
