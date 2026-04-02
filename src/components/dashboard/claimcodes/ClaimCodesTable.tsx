import React, { useState } from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';
import type { ClaimCodeDTO } from '@/interfaces/rsvp/domain.interface';
import type { UpdateClaimCodeDTO } from '@/lib/dashboard/dto/claimcodes';

interface ClaimCodesTableProps {
	items: ClaimCodeDTO[];
	onDisable: (claimCodeId: string) => Promise<void>;
	onUpdate: (claimCodeId: string, payload: UpdateClaimCodeDTO) => Promise<void>;
}

interface EditModalState {
	open: boolean;
	item: ClaimCodeDTO | null;
	expiresAt: string;
	maxUses: number;
	active: boolean;
	busy: boolean;
	error: string;
}

function getClaimCodeStatusLabel(status: ClaimCodeDTO['status']) {
	switch (status) {
		case 'active':
			return 'Activo';
		case 'disabled':
			return 'Desactivado';
		case 'expired':
			return 'Vencido';
		case 'exhausted':
			return 'Agotado';
		default:
			return status;
	}
}

const ClaimCodesTable: React.FC<ClaimCodesTableProps> = ({ items, onDisable, onUpdate }) => {
	const [editModal, setEditModal] = useState<EditModalState>({
		open: false,
		item: null,
		expiresAt: '',
		maxUses: 1,
		active: true,
		busy: false,
		error: '',
	});

	const openEditModal = (item: ClaimCodeDTO) => {
		setEditModal({
			open: true,
			item,
			expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : '',
			maxUses: item.maxUses,
			active: item.active,
			busy: false,
			error: '',
		});
	};

	const closeEditModal = () => {
		setEditModal({
			open: false,
			item: null,
			expiresAt: '',
			maxUses: 1,
			active: true,
			busy: false,
			error: '',
		});
	};

	const handleEditSubmit = async () => {
		if (!editModal.item) return;

		setEditModal({ ...editModal, busy: true, error: '' });
		try {
			await onUpdate(editModal.item.id, {
				active: editModal.active,
				expiresAt: editModal.expiresAt ? new Date(editModal.expiresAt).toISOString() : null,
				maxUses: editModal.maxUses,
			});
			closeEditModal();
		} catch (err) {
			setEditModal({
				...editModal,
				error:
					err instanceof Error ? err.message : 'Error al actualizar el código de acceso.',
				busy: false,
			});
		}
	};

	return (
		<>
			<div className="dashboard-card">
				<table className="dashboard-table">
					<thead>
						<tr>
							<th>ID</th>
							<th>Evento</th>
							<th>Estado</th>
							<th>Usos</th>
							<th>Expira</th>
							<th>Acciones</th>
						</tr>
					</thead>
					<tbody>
						{items.map((item) => (
							<tr key={item.id}>
								<td>{item.id.slice(0, 8)}...</td>
								<td>{item.eventId}</td>
								<td>
									<span
										className={`dashboard-badge dashboard-badge--${item.status}`}
									>
										{getClaimCodeStatusLabel(item.status)}
									</span>
								</td>
								<td>
									{item.usedCount}/{item.maxUses}
								</td>
								<td>
									{item.expiresAt
										? new Date(item.expiresAt).toLocaleString('es-MX')
										: 'Sin fecha'}
								</td>
								<td>
									<div className="dashboard-actions">
										<button
											type="button"
											onClick={() => openEditModal(item)}
											disabled={item.status === 'disabled'}
										>
											Editar
										</button>
										<button
											type="button"
											onClick={async () => {
												await onDisable(item.id);
											}}
											disabled={!item.active}
										>
											{item.active ? 'Desactivar' : 'Desactivado'}
										</button>
									</div>
								</td>
							</tr>
						))}
						{items.length === 0 && (
							<tr>
								<td colSpan={6}>No hay códigos de acceso registrados.</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{editModal.open && editModal.item && (
				<DashboardModalPortal>
					<div className="dashboard-modal-backdrop" role="dialog" aria-modal="true">
						<div className="dashboard-modal">
							<h3>Editar código de acceso</h3>
							<form
								onSubmit={(e) => {
									e.preventDefault();
									void handleEditSubmit();
								}}
							>
								<div className="dashboard-form-field">
									<label htmlFor="claim-edit-active">Activo</label>
									<select
										id="claim-edit-active"
										value={editModal.active ? 'true' : 'false'}
										onChange={(e) =>
											setEditModal({
												...editModal,
												active: e.target.value === 'true',
											})
										}
										disabled={editModal.busy}
									>
										<option value="true">Activo</option>
										<option value="false">Inactivo</option>
									</select>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor="claim-edit-max-uses">Usos máximos</label>
									<input
										id="claim-edit-max-uses"
										type="number"
										min={Math.max(1, editModal.item.usedCount)}
										max={10000}
										value={editModal.maxUses}
										onChange={(e) =>
											setEditModal({
												...editModal,
												maxUses: Number.parseInt(e.target.value) || 1,
											})
										}
										disabled={editModal.busy}
										required
									/>
									<p className="dashboard-form-help">
										Mínimo {editModal.item.usedCount} (ya usados), máximo 10000
									</p>
								</div>
								<div className="dashboard-form-field">
									<label htmlFor="claim-edit-expires">Expira en (opcional)</label>
									<input
										id="claim-edit-expires"
										type="datetime-local"
										value={editModal.expiresAt}
										onChange={(e) =>
											setEditModal({
												...editModal,
												expiresAt: e.target.value,
											})
										}
										min={new Date().toISOString().slice(0, 16)}
										disabled={editModal.busy}
									/>
									<p className="dashboard-form-help">
										Deja vacío para que no expire
									</p>
								</div>
								{editModal.error && (
									<p className="dashboard-error dashboard-error--full">
										{editModal.error}
									</p>
								)}
								<div className="dashboard-modal__actions dashboard-modal__actions--full">
									<button
										type="button"
										className="btn-secondary"
										onClick={closeEditModal}
										disabled={editModal.busy}
									>
										Cancelar
									</button>
									<button
										type="submit"
										className="btn-primary"
										disabled={editModal.busy}
									>
										{editModal.busy ? 'Guardando...' : 'Guardar'}
									</button>
								</div>
							</form>
						</div>
					</div>
				</DashboardModalPortal>
			)}
		</>
	);
};

export default ClaimCodesTable;
