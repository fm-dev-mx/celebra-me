import React, { useEffect, useState } from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';
import PhoneInputGroup from '@/components/shared/PhoneInputGroup';
import { ATTENDEE_OPTIONS } from '@/components/dashboard/guests/guest-form-constants';
import { resolvePhonePayload } from '@/lib/phone/resolve-phone-payload';
import type { AttendanceStatus } from '@/interfaces/rsvp/domain.interface';
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
			phone?: string | null;
			countryCode?: string;
			maxAllowedAttendees: number;
			attendanceStatus?: AttendanceStatus;
			attendeeCount?: number;
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
	const [countryCode, setCountryCode] = useState('+52');
	const [maxAllowedAttendees, setMaxAllowedAttendees] = useState(1);
	const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('pending');
	const [attendeeCount, setAttendeeCount] = useState(0);
	const [tags, setTags] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [localError, setLocalError] = useState('');

	const nameInputRef = React.useRef<HTMLInputElement>(null);
	const phoneInputRef = React.useRef<HTMLInputElement>(null);

	const resetForm = () => {
		setFullName('');
		setPhone('');
		setCountryCode('+52');
		setMaxAllowedAttendees(1);
		setAttendanceStatus('pending');
		setAttendeeCount(0);
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
		setCountryCode(initialGuest.countryCode || '+52');
		setMaxAllowedAttendees(initialGuest.maxAllowedAttendees);
		setAttendanceStatus(initialGuest.attendanceStatus);
		setAttendeeCount(initialGuest.attendeeCount);
		setTags(initialGuest.tags || []);
	}, [initialGuest, open]);

	if (!open) return null;

	const handleFormSubmit = async (stayOpen = false) => {
		const errors: Record<string, string> = {};

		if (!fullName.trim()) {
			errors.fullName = 'El nombre es obligatorio.';
		}

		const phonePayload = resolvePhonePayload({
			phone,
			countryCode,
			mode,
			initialPhone: initialGuest?.phone,
		});
		if (!phonePayload.ok) {
			errors.phone = phonePayload.error;
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
					phone: phonePayload.ok ? phonePayload.phone : undefined,
					countryCode: phonePayload.ok ? phonePayload.countryCode : undefined,
					maxAllowedAttendees,
					attendanceStatus: mode === 'edit' ? attendanceStatus : undefined,
					attendeeCount: mode === 'edit' ? attendeeCount : undefined,
					tags,
				},
				stayOpen,
			);

			if (!isInvitationFactory) {
				if (stayOpen) {
					resetForm();
				} else {
					onClose();
				}
			}
		} catch (err) {
			if ((err as { code?: string })?.code === 'conflict') {
				setFieldErrors({ phone: 'Este teléfono ya está registrado.' });
			} else {
				const msg = err instanceof Error ? err.message : String(err);
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
						<h3>{mode === 'create' ? 'Agregar invitado' : 'Editar invitado'}</h3>
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
									placeholder="Ej. Juan P&eacute;rez"
									autoFocus
								/>
								{fieldErrors.fullName && (
									<span className="guest-field-error">
										{fieldErrors.fullName}
									</span>
								)}
							</div>

							<div className="dashboard-form-field dashboard-form-field--full">
								<PhoneInputGroup
									id="guest"
									countryCode={countryCode}
									phone={phone}
									onCountryCodeChange={setCountryCode}
									onPhoneChange={setPhone}
									error={fieldErrors.phone}
									label="Tel&eacute;fono / WhatsApp"
									showOptional
									inputRef={phoneInputRef}
								/>
							</div>

							<div className="dashboard-form-section">
								<h4 className="dashboard-form-section__title">
									N&uacute;mero m&aacute;ximo de asistentes
								</h4>
								<div className="dashboard-form-field dashboard-form-field--full">
									<div className="guest-response-cards guest-response-cards--compact">
										{ATTENDEE_OPTIONS.map((num) => (
											<label key={num} className="guest-response-card">
												<input
													type="radio"
													name="maxAllowedAttendees"
													value={num}
													checked={maxAllowedAttendees === num}
													onChange={() => setMaxAllowedAttendees(num)}
												/>
												<div className="guest-response-card__content">
													{num === 10 ? '10+' : num}
												</div>
											</label>
										))}
									</div>
								</div>
							</div>

							<div className="dashboard-form-section">
								<h4 className="dashboard-form-section__title">Categor&iacute;as</h4>
								<div className="dashboard-form-field dashboard-form-field--full">
									<div className="guest-response-cards guest-response-cards--tags">
										{PREDEFINED_TAGS.map((tag) => (
											<label key={tag} className="guest-response-card">
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
												<div className="guest-response-card__content">
													{tag}
												</div>
											</label>
										))}
									</div>
								</div>
							</div>

							{mode === 'edit' && (
								<div className="dashboard-form-section dashboard-form-field--full">
									<h4 className="dashboard-form-section__title">
										Respuesta del invitado
									</h4>
									<div className="dashboard-form-grid dashboard-form-grid--nested">
										<div className="dashboard-form-field">
											<label htmlFor="attendanceStatus">Estado de RSVP</label>
											<select
												id="attendanceStatus"
												value={attendanceStatus}
												onChange={(event) => {
													const newStatus = event.target
														.value as AttendanceStatus;
													setAttendanceStatus(newStatus);
													if (newStatus === 'confirmed') {
														if (attendeeCount < 1) setAttendeeCount(1);
													} else {
														setAttendeeCount(0);
													}
												}}
											>
												<option value="pending">Pendiente</option>
												<option value="confirmed">Confirmado</option>
												<option value="declined">Declinado</option>
											</select>
										</div>
										{attendanceStatus === 'confirmed' && (
											<div className="dashboard-form-field">
												<label htmlFor="attendeeCount">
													Asistentes reales
												</label>
												<input
													id="attendeeCount"
													type="number"
													min={1}
													max={maxAllowedAttendees}
													value={attendeeCount}
													onChange={(event) =>
														setAttendeeCount(Number(event.target.value))
													}
												/>
											</div>
										)}
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
