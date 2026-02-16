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
			phone: string;
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
	const [phone, setPhone] = useState('');
	const [maxAllowedAttendees, setMaxAllowedAttendees] = useState(1);
	const [attendanceStatus, setAttendanceStatus] = useState<'pending' | 'confirmed' | 'declined'>(
		'pending',
	);
	const [attendeeCount, setAttendeeCount] = useState(0);
	const [guestMessage, setGuestMessage] = useState('');
	const [tagsInput, setTagsInput] = useState('');
	const [saving, setSaving] = useState(false);
	const [localError, setLocalError] = useState('');
	const nameInputRef = React.useRef<HTMLInputElement>(null);

	const resetForm = () => {
		setFullName('');
		setPhone('');
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
		setPhone(initialGuest.phone);
		setMaxAllowedAttendees(initialGuest.maxAllowedAttendees);
		setAttendanceStatus(initialGuest.attendanceStatus);
		setAttendeeCount(initialGuest.attendeeCount);
		setGuestMessage(initialGuest.guestMessage || '');
		setTagsInput((initialGuest.tags || []).join(', '));
	}, [initialGuest, open]);

	if (!open) return null;

	const handleFormSubmit = async (stayOpen = false) => {
		// Validations
		const PHONE_REGEX = /^\d{10}$/;
		if (!PHONE_REGEX.test(phone.replace(/[\s-]/g, ''))) {
			setLocalError('El teléfono debe ser de 10 dígitos.');
			return;
		}

		if (mode === 'edit' && attendeeCount > maxAllowedAttendees) {
			setLocalError(
				`El número de asistentes (${attendeeCount}) no puede superar el límite (${maxAllowedAttendees}).`,
			);
			return;
		}

		setSaving(true);
		setLocalError('');
		try {
			const tags = tagsInput
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);
			await onSubmit(
				{
					fullName: fullName.trim(),
					phone: phone.trim(),
					maxAllowedAttendees,
					attendanceStatus: mode === 'edit' ? attendanceStatus : undefined,
					attendeeCount: mode === 'edit' ? attendeeCount : undefined,
					guestMessage: mode === 'edit' ? guestMessage.trim() : undefined,
					tags,
				},
				stayOpen,
			);

			if (stayOpen) {
				resetForm();
			} else {
				onClose();
			}
		} catch (err) {
			setLocalError(err instanceof Error ? err.message : 'Error al guardar invitado.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div
			className="dashboard-modal-backdrop"
			role="dialog"
			aria-modal="true"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
				<button
					type="button"
					className="dashboard-modal-close"
					onClick={onClose}
					aria-label="Cerrar"
				>
					×
				</button>
				<h3>{mode === 'create' ? 'Agregar invitado' : 'Editar invitado'}</h3>
				<form
					className="dashboard-form-grid"
					onSubmit={(event) => {
						event.preventDefault();
						void handleFormSubmit(false);
					}}
				>
					<div className="dashboard-form-field">
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
					<div className="dashboard-form-field">
						<label htmlFor="phone">Teléfono (WhatsApp)</label>
						<input
							id="phone"
							value={phone}
							onChange={(event) => setPhone(event.target.value)}
							required
							placeholder="668 123 4567"
						/>
					</div>
					<div className="dashboard-form-field">
						<label htmlFor="maxAllowedAttendees">Límite de invitados</label>
						<input
							id="maxAllowedAttendees"
							type="number"
							min={1}
							max={50}
							value={maxAllowedAttendees}
							onChange={(event) => setMaxAllowedAttendees(Number(event.target.value))}
							required
						/>
					</div>
					<div className="dashboard-form-field">
						<label htmlFor="tagsInput">Categorías (opcional)</label>
						<input
							id="tagsInput"
							value={tagsInput}
							onChange={(event) => setTagsInput(event.target.value)}
							placeholder="Familia, Amigos..."
						/>
					</div>

					{mode === 'edit' && (
						<div className="dashboard-form-section" style={{ gridColumn: '1 / -1' }}>
							<div
								className="dashboard-form-grid"
								style={{ padding: 0, border: 'none', background: 'none' }}
							>
								<div className="dashboard-form-field">
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
								<div className="dashboard-form-field">
									<label htmlFor="attendeeCount">Asistentes reales</label>
									<input
										id="attendeeCount"
										type="number"
										min={0}
										max={maxAllowedAttendees}
										value={attendeeCount}
										onChange={(event) =>
											setAttendeeCount(Number(event.target.value))
										}
									/>
								</div>
								<div
									className="dashboard-form-field"
									style={{ gridColumn: '1 / -1' }}
								>
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
						</div>
					)}

					{localError && (
						<p className="dashboard-guests__error" style={{ gridColumn: '1 / -1' }}>
							{localError}
						</p>
					)}

					<div className="dashboard-modal__actions" style={{ gridColumn: '1 / -1' }}>
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
