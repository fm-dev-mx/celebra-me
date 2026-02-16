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
			phone?: string;
			maxAllowedAttendees: number;
			attendanceStatus?: 'pending' | 'confirmed' | 'declined';
			attendeeCount?: number;
			guestMessage?: string;
			tags?: string[];
		},
		stayOpen?: boolean,
	) => Promise<void>;
}

const PREDEFINED_TAGS = ['Familia', 'Amigos', 'VIP', 'Trabajo'];

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
	const [tags, setTags] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [localError, setLocalError] = useState('');

	const nameInputRef = React.useRef<HTMLInputElement>(null);
	const phoneInputRef = React.useRef<HTMLInputElement>(null);
	const attendeesInputRef = React.useRef<HTMLInputElement>(null);

	const resetForm = () => {
		setFullName('');
		setPhone('');
		setMaxAllowedAttendees(1);
		setAttendanceStatus('pending');
		setAttendeeCount(0);
		setGuestMessage('');
		setTags([]);
		setFieldErrors({});
		setLocalError('');
		setTimeout(() => nameInputRef.current?.focus(), 0);
	};

	useEffect(() => {
		if (!open) return;
		if (!initialGuest) {
			resetForm();
			return;
		}
		setFullName(initialGuest.fullName);
		setPhone(initialGuest.phone || '');
		setMaxAllowedAttendees(initialGuest.maxAllowedAttendees);
		setAttendanceStatus(initialGuest.attendanceStatus);
		setAttendeeCount(initialGuest.attendeeCount);
		setGuestMessage(initialGuest.guestMessage || '');
		setTags(initialGuest.tags || []);
	}, [initialGuest, open]);

	if (!open) return null;

	const handleFormSubmit = async (stayOpen = false) => {
		const errors: Record<string, string> = {};

		if (!fullName.trim()) {
			errors.fullName = 'El nombre es obligatorio.';
		}

		if (phone.trim()) {
			const PHONE_REGEX = /^\d{10}$/;
			if (!PHONE_REGEX.test(phone.replace(/[\s-]/g, ''))) {
				errors.phone = 'El teléfono debe ser de 10 dígitos.';
			}
		}

		if (mode === 'edit' && attendeeCount > maxAllowedAttendees) {
			errors.attendeeCount = `No puede superar el límite (${maxAllowedAttendees}).`;
		}

		if (Object.keys(errors).length > 0) {
			setFieldErrors(errors);
			return;
		}

		setSaving(true);
		setFieldErrors({});
		setLocalError('');
		try {
			await onSubmit(
				{
					fullName: fullName.trim(),
					phone: phone.trim() || undefined,
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
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('ya está registrado') || msg.toLowerCase().includes('conflict')) {
				setFieldErrors({ phone: 'Este teléfono ya está registrado.' });
			} else {
				setLocalError(msg === '[object Object]' ? 'Error al guardar invitado.' : msg);
			}
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
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									phoneInputRef.current?.focus();
								}
							}}
							required
							placeholder="Ej. Juan Pérez"
							autoFocus
						/>
						{fieldErrors.fullName && (
							<span className="field-error">{fieldErrors.fullName}</span>
						)}
					</div>
					<div className="dashboard-form-field">
						<label htmlFor="phone">Teléfono (WhatsApp)</label>
						<input
							id="phone"
							ref={phoneInputRef}
							value={phone}
							onChange={(event) => setPhone(event.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									attendeesInputRef.current?.focus();
								}
							}}
							placeholder="Opcional (para WhatsApp)"
						/>
						{fieldErrors.phone && (
							<span className="field-error">{fieldErrors.phone}</span>
						)}
					</div>
					<div className="dashboard-form-field">
						<label htmlFor="maxAllowedAttendees">Límite de invitados</label>
						<input
							id="maxAllowedAttendees"
							ref={attendeesInputRef}
							type="number"
							min={1}
							max={50}
							value={maxAllowedAttendees}
							onChange={(event) => setMaxAllowedAttendees(Number(event.target.value))}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									if (mode === 'create') {
										void handleFormSubmit(true);
									}
								}
							}}
							required
						/>
					</div>
					<div className="dashboard-form-field" style={{ gridColumn: '1 / -1' }}>
						<label>Categorías (opcional)</label>
						<div className="category-checkboxes">
							{PREDEFINED_TAGS.map((tag) => (
								<label key={tag} className="checkbox-item">
									<input
										type="checkbox"
										checked={tags.includes(tag)}
										onChange={(e) => {
											if (e.target.checked) {
												setTags([...tags, tag]);
											} else {
												setTags(tags.filter((t) => t !== tag));
											}
										}}
									/>
									{tag}
								</label>
							))}
						</div>
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
						{mode === 'create' ? (
							<>
								<button type="submit" className="btn-accent" disabled={saving}>
									{saving ? 'Guardando...' : 'Guardar y cerrar'}
								</button>
								<button
									type="button"
									className="btn-primary"
									disabled={saving}
									onClick={() => void handleFormSubmit(true)}
								>
									{saving ? 'Guardando...' : 'Guardar y agregar otro'}
								</button>
							</>
						) : (
							<button type="submit" className="btn-primary" disabled={saving}>
								{saving ? 'Guardando...' : 'Guardar y cerrar'}
							</button>
						)}
					</div>
				</form>
			</div>
		</div>
	);
};

export default GuestFormModal;
