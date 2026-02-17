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

		// Body Scroll Lock
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		document.body.classList.add('modal-open');

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

		return () => {
			document.body.style.overflow = originalOverflow;
			document.body.classList.remove('modal-open');
		};
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
				<div className="dashboard-modal__header">
					<h3>{mode === 'create' ? 'Agregar Invitado' : 'Editar Invitado'}</h3>
					<button className="btn-close" onClick={onClose} aria-label="Cerrar modal">
						&times;
					</button>
				</div>
				<div className="dashboard-modal__content">
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
								onChange={(event) => {
									const val = event.target.value.replace(/[^\d+ ]/g, '');
									setPhone(val);
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										// No auto-focus next since limit is now radio cards
									}
								}}
								placeholder="Opcional (10 dígitos)"
							/>
							{fieldErrors.phone && (
								<span className="field-error">{fieldErrors.phone}</span>
							)}
						</div>

						<div className="dashboard-form-field dashboard-form-field--full">
							<label htmlFor="maxAllowedAttendees">
								¿Cuántos acompañantes permite?
							</label>
							<div className="radio-cards-container">
								{[1, 2, 3, 4, 5, 10].map((num) => (
									<label key={num} className="radio-card">
										<input
											type="radio"
											name="maxAllowedAttendees"
											value={num}
											checked={maxAllowedAttendees === num}
											onChange={() => setMaxAllowedAttendees(num)}
										/>
										<div className="radio-card__content">
											{num === 10 ? '10+' : num}
										</div>
									</label>
								))}
							</div>
						</div>
						<div className="dashboard-form-field dashboard-form-field--full">
							<label>Categorías (opcional)</label>
							<div className="radio-cards-container radio-cards-container--tags">
								{PREDEFINED_TAGS.map((tag) => (
									<label key={tag} className="radio-card">
										<input
											type="checkbox"
											className="hidden-input"
											checked={tags.includes(tag)}
											onChange={(e) => {
												if (e.target.checked) {
													setTags([...tags, tag]);
												} else {
													setTags(tags.filter((t) => t !== tag));
												}
											}}
										/>
										<div className="radio-card__content">{tag}</div>
									</label>
								))}
							</div>
						</div>

						{mode === 'edit' && (
							<div
								className="dashboard-form-section"
								style={{ gridColumn: '1 / -1' }}
							>
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
											onChange={(event) =>
												setGuestMessage(event.target.value)
											}
											rows={2}
											placeholder="Nota opcional..."
										/>
									</div>
								</div>
							</div>
						)}

						{localError && (
							<div
								className="dashboard-guests__error"
								style={{
									color: 'var(--color-wax-seal)',
									marginTop: 'var(--spacing-md)',
									fontSize: '0.85rem',
								}}
							>
								{localError}
							</div>
						)}
					</form>
				</div>

				<div className="dashboard-modal__footer">
					<div className="modal-actions">
						<button
							type="button"
							className="btn-secondary"
							onClick={onClose}
							disabled={saving}
						>
							Cancelar
						</button>
						{mode === 'create' ? (
							<>
								<button
									type="submit"
									className="btn-accent"
									disabled={saving}
									onClick={(e) => {
										e.preventDefault();
										void handleFormSubmit(true);
									}}
								>
									{saving ? 'Guardando...' : 'Guardar y masivo'}
								</button>
								<button
									type="button"
									className="btn-primary"
									disabled={saving}
									onClick={(e) => {
										e.preventDefault();
										void handleFormSubmit(false);
									}}
								>
									{saving ? 'Guardando...' : 'Guardar'}
								</button>
							</>
						) : (
							<button
								type="button"
								className="btn-primary"
								disabled={saving}
								onClick={(e) => {
									e.preventDefault();
									void handleFormSubmit(false);
								}}
							>
								{saving ? 'Guardando...' : 'Actualizar'}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default GuestFormModal;
