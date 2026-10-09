import React, { useEffect, useState } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';
import PhoneInputGroup from '@/components/shared/PhoneInputGroup';
import GuestPeopleStepper from '@/components/dashboard/guests/GuestPeopleStepper';
import { MAX_CUSTOM_ATTENDEES } from '@/components/dashboard/guests/guest-form-constants';
import { resolvePhonePayload } from '@/lib/phone/resolve-phone-payload';
import { getVisibleTags, isSystemTag } from '@/lib/guests/guest-tags';
import GuestTagChips from '@/components/dashboard/guests/GuestTagChips';
import { GuestFormFooter, GuestResponseFields } from '@/components/dashboard/guests/GuestFormParts';
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
	const [peopleInput, setPeopleInput] = useState('1');
	const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('pending');
	const [attendeeCount, setAttendeeCount] = useState(0);
	const [tags, setTags] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [localError, setLocalError] = useState('');

	const nameInputRef = React.useRef<HTMLInputElement>(null);
	const phoneInputRef = React.useRef<HTMLInputElement>(null);
	const focusTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const resetForm = () => {
		setFullName('');
		setPhone('');
		setCountryCode('+52');
		setPeopleInput('1');
		setAttendanceStatus('pending');
		setAttendeeCount(0);
		setTags([]);
		setFieldErrors({});
		setLocalError('');
		if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
		focusTimerRef.current = setTimeout(() => nameInputRef.current?.focus(), 0);
	};

	React.useEffect(() => {
		return () => {
			if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
		};
	}, []);

	useEffect(() => {
		if (!open) return;

		if (!initialGuest) {
			resetForm();
			return;
		}
		setFullName(initialGuest.fullName);
		setPhone(initialGuest.phone || '');
		setCountryCode(initialGuest.countryCode || '+52');
		setPeopleInput(String(initialGuest.maxAllowedAttendees));
		setAttendanceStatus(initialGuest.attendanceStatus);
		setAttendeeCount(initialGuest.attendeeCount);
		setTags(initialGuest.tags || []);
	}, [initialGuest, open]);

	if (!open) return null;

	const liveMaxAttendees = Math.max(
		1,
		Math.min(parseInt(peopleInput, 10) || MAX_CUSTOM_ATTENDEES, MAX_CUSTOM_ATTENDEES),
	);

	const resolveMaxAttendees = (): { value: number; error?: string } => {
		const parsed = parseInt(peopleInput.trim(), 10);
		if (isNaN(parsed) || parsed < 1)
			return { value: 1, error: 'Escriba cuántas personas vienen.' };
		if (parsed > MAX_CUSTOM_ATTENDEES)
			return { value: 1, error: `El máximo es ${MAX_CUSTOM_ATTENDEES} personas.` };
		return { value: parsed };
	};

	const handleFormSubmit = async (stayOpen = false) => {
		const errors: Record<string, string> = {};

		if (!fullName.trim()) {
			errors.fullName = 'Escriba el nombre del invitado.';
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

		const maxResult = resolveMaxAttendees();
		if (maxResult.error) {
			errors.customAttendees = maxResult.error;
		}

		if (mode === 'edit' && attendeeCount > maxResult.value) {
			errors.attendeeCount = `No puede superar el límite (${maxResult.value}).`;
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
					maxAllowedAttendees: maxResult.value,
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
				const msg = err instanceof Error ? err.message : 'Error al guardar invitado.';
				setLocalError(msg);
			}
		} finally {
			setSaving(false);
		}
	};

	return (
		<ModalShell
			title={mode === 'create' ? 'Agregar invitado' : 'Editar invitado'}
			size="lg"
			className="guest-form-modal"
			onClose={onClose}
			footer={
				<GuestFormFooter
					mode={mode}
					saving={saving}
					isInvitationFactory={isInvitationFactory}
					onClose={onClose}
					onPostpone={onPostpone}
					onSaveAndAddAnother={() => void handleFormSubmit(true)}
				/>
			}
		>
			<div className="dashboard-modal__content">
				{/* Order by importance: name → people → phone → group */}
				<form
					id="guest-form"
					className="guest-form"
					onSubmit={(event) => {
						event.preventDefault();
						void handleFormSubmit(false);
					}}
				>
					<div className="dashboard-form-field">
						<label htmlFor="fullName">Nombre del invitado</label>
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
							placeholder="Así aparecerá en la invitación"
							autoFocus
						/>
						{fieldErrors.fullName && (
							<span className="guest-field-error">{fieldErrors.fullName}</span>
						)}
					</div>

					<div className="guest-form__people">
						<div className="guest-form__people-text">
							<label htmlFor="guest-people">¿Cuántas personas?</label>
							<span id="guest-people-hint" className="guest-field-hint">
								Incluya al invitado principal.
							</span>
						</div>
						<GuestPeopleStepper
							id="guest-people"
							value={peopleInput}
							max={MAX_CUSTOM_ATTENDEES}
							onChange={setPeopleInput}
							describedBy="guest-people-hint"
							invalid={Boolean(fieldErrors.customAttendees)}
							compact
						/>
						{fieldErrors.customAttendees && (
							<span className="guest-field-error guest-form__people-error">
								{fieldErrors.customAttendees}
							</span>
						)}
					</div>

					<div className="dashboard-form-field">
						<PhoneInputGroup
							id="guest"
							countryCode={countryCode}
							phone={phone}
							onCountryCodeChange={setCountryCode}
							onPhoneChange={setPhone}
							error={fieldErrors.phone}
							label="Teléfono (WhatsApp)"
							showOptional
							inputRef={phoneInputRef}
						/>
						{!fieldErrors.phone && !phone.trim() && (
							<span className="guest-field-hint">
								Sin teléfono, podrá elegir el contacto al enviar.
							</span>
						)}
					</div>

					<fieldset className="guest-form__groups">
						<legend>
							Grupo <span className="guest-form__optional">· opcional</span>
						</legend>
						<GuestTagChips
							value={getVisibleTags(tags)}
							onChange={(groups) => setTags([...tags.filter(isSystemTag), ...groups])}
							label="Grupo"
						/>
					</fieldset>

					{mode === 'edit' && (
						<GuestResponseFields
							status={attendanceStatus}
							attendeeCount={attendeeCount}
							maxAttendees={liveMaxAttendees}
							error={fieldErrors.attendeeCount}
							onStatusChange={(newStatus) => {
								setAttendanceStatus(newStatus);
								if (newStatus === 'confirmed') {
									if (attendeeCount < 1) setAttendeeCount(1);
								} else {
									setAttendeeCount(0);
								}
							}}
							onAttendeeCountChange={setAttendeeCount}
						/>
					)}

					{localError && <div className="dashboard-error">{localError}</div>}
				</form>
			</div>
		</ModalShell>
	);
};

export default GuestFormModal;
