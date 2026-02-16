import React, { useEffect, useState } from 'react';
import type { DashboardGuestItem } from './types';

interface GuestFormModalProps {
	open: boolean;
	mode: 'create' | 'edit';
	initialGuest: DashboardGuestItem | null;
	onClose: () => void;
	onSubmit: (
		payload: {
			fullName: string;
			phoneE164: string;
			maxAllowedAttendees: number;
			attendanceStatus?: 'pending' | 'confirmed' | 'declined';
			attendeeCount?: number;
			guestMessage?: string;
			tags?: string[];
		},
		stayOpen?: boolean,
	) => Promise<void>;
}

const GuestFormModal: React.FC<GuestFormModalProps> = ({
	open,
	mode,
	initialGuest,
	onClose,
	onSubmit,
}) => {
	const [fullName, setFullName] = useState('');
	const [phoneE164, setPhoneE164] = useState('');
	const [maxAllowedAttendees, setMaxAllowedAttendees] = useState(1);
	const [attendanceStatus, setAttendanceStatus] = useState<'pending' | 'confirmed' | 'declined'>(
		'pending',
	);
	const [attendeeCount, setAttendeeCount] = useState(0);
	const [guestMessage, setGuestMessage] = useState('');
	const [tagsInput, setTagsInput] = useState('');
	const [saving, setSaving] = useState(false);
	const nameInputRef = React.useRef<HTMLInputElement>(null);

	const resetForm = () => {
		setFullName('');
		setPhoneE164('');
		setMaxAllowedAttendees(1);
		setAttendanceStatus('pending');
		setAttendeeCount(0);
		setGuestMessage('');
		setTagsInput('');
		nameInputRef.current?.focus();
	};

	useEffect(() => {
		if (!open) return;
		if (!initialGuest) {
			resetForm();
			return;
		}
		setFullName(initialGuest.fullName);
		setPhoneE164(initialGuest.phoneE164);
		setMaxAllowedAttendees(initialGuest.maxAllowedAttendees);
		setAttendanceStatus(initialGuest.attendanceStatus);
		setAttendeeCount(initialGuest.attendeeCount);
		setGuestMessage(initialGuest.guestMessage || '');
		setTagsInput((initialGuest.tags || []).join(', '));
	}, [initialGuest, open]);

	if (!open) return null;

	const handleFormSubmit = async (stayOpen = false) => {
		setSaving(true);
		try {
			const tags = tagsInput
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
			await onSubmit(
				{
					fullName,
					phoneE164,
					maxAllowedAttendees,
					attendanceStatus: mode === 'edit' ? attendanceStatus : undefined,
					attendeeCount: mode === 'edit' ? attendeeCount : undefined,
					guestMessage: mode === 'edit' ? guestMessage : undefined,
					tags,
				},
				stayOpen,
			);

			if (stayOpen) {
				resetForm();
			} else {
				onClose();
			}
		} finally {
			setSaving(false);
		}
	};

	return (
		<div
			className="dashboard-guests__modal-backdrop"
			role="dialog"
			aria-modal="true"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="dashboard-guests__modal">
				<button
					type="button"
					className="dashboard-guests__modal-close"
					onClick={onClose}
					aria-label="Cerrar"
				>
					×
				</button>
				<h3>{mode === 'create' ? 'Agregar invitado' : 'Editar invitado'}</h3>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void handleFormSubmit(false);
					}}
				>
					<div className="dashboard-guests__form-grid">
						<div className="form-field">
							<label htmlFor="fullName">Nombre completo</label>
							<input
								id="fullName"
								ref={nameInputRef}
								value={fullName}
								onChange={(event) => setFullName(event.target.value)}
								required
								placeholder="Ej. Juan Pérez"
								autoFocus
							/>
						</div>
						<div className="form-field">
							<label htmlFor="phoneE164">Teléfono (WhatsApp)</label>
							<input
								id="phoneE164"
								value={phoneE164}
								onChange={(event) => setPhoneE164(event.target.value)}
								required
								placeholder="+52 1..."
							/>
						</div>
						<div className="form-field">
							<label htmlFor="maxAllowedAttendees">Límite de invitados</label>
							<input
								id="maxAllowedAttendees"
								type="number"
								min={1}
								max={20}
								value={maxAllowedAttendees}
								onChange={(event) =>
									setMaxAllowedAttendees(Number(event.target.value))
								}
								required
							/>
						</div>
						<div className="form-field">
							<label htmlFor="tagsInput">Categorías (opcional)</label>
							<input
								id="tagsInput"
								value={tagsInput}
								onChange={(event) => setTagsInput(event.target.value)}
								placeholder="Familia, Amigos..."
							/>
						</div>
					</div>

					{mode === 'edit' && (
						<div className="dashboard-guests__form-section">
							<div className="dashboard-guests__form-grid">
								<div className="form-field">
									<label htmlFor="attendanceStatus">Estado</label>
									<select
										id="attendanceStatus"
										value={attendanceStatus}
										onChange={(event) =>
											setAttendanceStatus(
												event.target.value as
													| 'pending'
													| 'confirmed'
													| 'declined',
											)
										}
									>
										<option value="pending">⏳ Pendiente</option>
										<option value="confirmed">✅ Confirmado</option>
										<option value="declined">❌ Declinado</option>
									</select>
								</div>
								<div className="form-field">
									<label htmlFor="attendeeCount">Asistentes reales</label>
									<input
										id="attendeeCount"
										type="number"
										min={0}
										max={20}
										value={attendeeCount}
										onChange={(event) =>
											setAttendeeCount(Number(event.target.value))
										}
									/>
								</div>
							</div>
							<div className="form-field">
								<label htmlFor="guestMessage">Mensaje del invitado</label>
								<textarea
									id="guestMessage"
									value={guestMessage}
									onChange={(event) => setGuestMessage(event.target.value)}
									rows={2}
									placeholder="Nota opcional..."
								/>
							</div>
						</div>
					)}

					<div className="dashboard-guests__modal-actions">
						<button type="button" className="btn-secondary" onClick={onClose}>
							Cancelar
						</button>
						{mode === 'create' && (
							<button
								type="button"
								className="btn-accent"
								disabled={saving}
								onClick={() => void handleFormSubmit(true)}
							>
								{saving ? 'Guardando...' : 'Guardar y agregar otro'}
							</button>
						)}
						<button type="submit" className="btn-primary" disabled={saving}>
							{saving ? 'Guardando...' : 'Guardar y cerrar'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default GuestFormModal;
