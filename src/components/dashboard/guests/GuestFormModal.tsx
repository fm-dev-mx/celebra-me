import React, { useEffect, useState } from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface GuestFormModalProps {
	open: boolean;
	mode: 'create' | 'edit';
	initialGuest: DashboardGuestItem | null;
	onClose: () => void;
	onPostpone?: () => void;
	isInvitationFactory?: boolean;
	onSubmit: (
		payload: {
			fullName: string;
			phone?: string;
			maxAllowedAttendees: number;
			attendanceStatus?: 'pending' | 'confirmed' | 'declined';
			attendeeCount?: number;
			guestComment?: string;
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
	onPostpone,
	isInvitationFactory = false,
	onSubmit,
}) => {
	const [fullName, setFullName] = useState('');
	const [phone, setPhone] = useState('');
	const [maxAllowedAttendees, setMaxAllowedAttendees] = useState(1);
	const [attendanceStatus, setAttendanceStatus] = useState<'pending' | 'confirmed' | 'declined'>(
		'pending',
	);
	const [attendeeCount, setAttendeeCount] = useState(0);
	const [guestComment, setGuestComment] = useState('');
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
		setGuestComment('');
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
		setGuestComment(initialGuest.guestComment || '');
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
					guestComment: mode === 'edit' ? guestComment.trim() : undefined,
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
		<DashboardModalPortal>
			<div
				className="dashboard-modal-backdrop"
				role="dialog"
				aria-modal="true"
				onClick={(e) => {
					if (e.target === e.currentTarget) onClose();
				}}
			>
				<div
					className="dashboard-modal dashboard-modal--full"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="dashboard-modal__header">
						<h3>{mode === 'create' ? 'Agregar Invitado' : 'Editar Invitado'}</h3>
						<button
							type="button"
							className="btn-close"
							onClick={onClose}
							aria-label="Cerrar modal"
						>
							✕
						</button>
					</div>
					<div className="dashboard-modal__content">
						<form
							id="guest-form"
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
								<div className="radio-cards-container radio-cards-container--compact">
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
								<div className="dashboard-form-section dashboard-form-field--full">
									<div className="dashboard-form-grid dashboard-form-grid--nested">
										<div className="dashboard-form-field">
											<label htmlFor="attendanceStatus">Estado de RSVP</label>
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
												className="dashboard-form-field__input"
											>
												<option value="pending">Pendiente</option>
												<option value="confirmed">Confirmado</option>
												<option value="declined">Declinado</option>
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
												className="dashboard-form-field__input"
											/>
										</div>
										<div className="dashboard-form-field dashboard-form-field--full">
											<label htmlFor="guestComment">
												Comentario / Nota del invitado
											</label>
											<textarea
												id="guestComment"
												value={guestComment}
												onChange={(event) =>
													setGuestComment(event.target.value)
												}
												rows={3}
												placeholder="Mensaje o nota especial..."
												className="dashboard-form-field__textarea"
											/>
										</div>
									</div>
								</div>
							)}

							{localError && <div className="dashboard-error">{localError}</div>}
						</form>
					</div>

					<div className="dashboard-modal__footer">
						<button
							type="button"
							className="btn-secondary btn-secondary--modal"
							onClick={onClose}
							disabled={saving}
						>
							Cancelar
						</button>

						{isInvitationFactory && onPostpone && (
							<button
								type="button"
								className="btn-secondary btn-secondary--postpone"
								disabled={saving}
								onClick={onPostpone}
							>
								Posponer
							</button>
						)}

						<div className="footer-actions">
							{mode === 'create' && (
								<button
									type="button"
									className="btn-accent"
									disabled={saving}
									onClick={(e) => {
										e.preventDefault();
										void handleFormSubmit(true);
									}}
								>
									{saving ? '...' : 'Guardar y Nuevo'}
								</button>
							)}
							<button
								type="submit"
								form="guest-form"
								className="btn-primary"
								disabled={saving}
							>
								{saving
									? 'Guardando...'
									: isInvitationFactory
										? 'Confirmar y enviar'
										: mode === 'create'
											? 'Guardar'
											: 'Actualizar'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</DashboardModalPortal>
	);
};

export default GuestFormModal;
