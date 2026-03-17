import React from 'react';
import { createPortal } from 'react-dom';
import type { DashboardGuestItem } from './types';

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

	return createPortal(
		<div className="dashboard-modal-backdrop" onClick={onClose} role="presentation">
			<div
				className="dashboard-modal dashboard-modal--confirm"
				onClick={(event) => event.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="delete-modal-title"
			>
				<div className="dashboard-modal__header">
					<h3 id="delete-modal-title">Confirmar eliminación</h3>
					<button className="btn-close" onClick={onClose} aria-label="Cerrar modal">
						&times;
					</button>
				</div>

				<div className="dashboard-modal__content">
					<p className="dashboard-modal__confirm-text">
						¿Estás seguro de que deseas eliminar a{' '}
						<strong>{guestToDelete.fullName}</strong>?
					</p>

					<p className="dashboard-modal__confirm-warning">
						Esta acción no se puede deshacer.
					</p>
				</div>

				<div className="dashboard-modal__footer">
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
				</div>
			</div>
		</div>,
		document.body,
	);
};

export default GuestDeleteConfirmModal;
