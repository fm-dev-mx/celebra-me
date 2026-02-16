import React, { useState } from 'react';
import type { ClaimCodeDTO } from '@/lib/rsvp-v2/types';
import { adminApi } from '@/lib/dashboard/adminApi';

interface ClaimCodesTableProps {
	items: ClaimCodeDTO[];
	onDisable: (claimCodeId: string) => Promise<void>;
	onRefresh: () => Promise<void>;
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

const ClaimCodesTable: React.FC<ClaimCodesTableProps> = ({ items, onDisable, onRefresh }) => {
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
			await adminApi.updateClaimCode(editModal.item.id, {
				active: editModal.active,
				expiresAt: editModal.expiresAt ? new Date(editModal.expiresAt).toISOString() : null,
				maxUses: editModal.maxUses,
			});
			closeEditModal();
			await onRefresh();
		} catch (err) {
			setEditModal({
				...editModal,
				error: err instanceof Error ? err.message : 'Error al actualizar claim code.',
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
										{item.status}
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
								<td colSpan={6}>Sin claim codes registrados.</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{editModal.open && editModal.item && (
				<div className="dashboard-guests__modal-backdrop" role="dialog" aria-modal="true">
					<div className="dashboard-guests__modal">
						<h3>Editar Claim Code</h3>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								void handleEditSubmit();
							}}
						>
							<label>
								Activo
								<select
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
							</label>
							<label>
								Usos máximos
								<input
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
							</label>
							<label>
								Expira en (opcional)
								<input
									type="datetime-local"
									value={editModal.expiresAt}
									onChange={(e) =>
										setEditModal({ ...editModal, expiresAt: e.target.value })
									}
									min={new Date().toISOString().slice(0, 16)}
									disabled={editModal.busy}
								/>
								<p className="dashboard-form-help">Deja vacío para que no expire</p>
							</label>
							{editModal.error && (
								<p className="dashboard-guests__error">{editModal.error}</p>
							)}
							<div className="dashboard-guests__modal-actions">
								<button
									type="button"
									onClick={closeEditModal}
									disabled={editModal.busy}
								>
									Cancelar
								</button>
								<button type="submit" disabled={editModal.busy}>
									{editModal.busy ? 'Guardando...' : 'Guardar'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
};

export default ClaimCodesTable;
