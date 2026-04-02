import { motion, AnimatePresence } from 'framer-motion';
import type { RefObject } from 'react';
import { type AttendanceStatus } from '@/components/invitation/rsvp-logic';

export function NameField(props: {
	nameLocked: boolean;
	touched: Record<string, boolean>;
	errors: Record<string, string>;
	nameLabel: string;
	name: string;
	nameRef: RefObject<HTMLInputElement | null>;
	prefersReducedMotion: boolean;
	onNameChange: (value: string) => void;
	onBlur: (field: string) => void;
}) {
	const {
		nameLocked,
		touched,
		errors,
		nameLabel,
		name,
		nameRef,
		prefersReducedMotion,
		onNameChange,
		onBlur,
	} = props;
	if (nameLocked) return null;

	return (
		<motion.div
			className={`rsvp__field ${touched.name && errors.name ? 'rsvp__field--error' : ''}`}
			initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
			whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
			viewport={prefersReducedMotion ? undefined : { once: true }}
		>
			<label htmlFor="name">{nameLabel}</label>
			<input
				ref={nameRef}
				type="text"
				id="name"
				placeholder="Escribe tu nombre"
				value={name}
				onChange={(e) => onNameChange(e.target.value)}
				onBlur={() => onBlur('name')}
				aria-invalid={!!(touched.name && errors.name)}
				aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
			/>
			{touched.name && errors.name && (
				<p className="rsvp__field-error" id="name-error" role="alert">
					{errors.name}
				</p>
			)}
		</motion.div>
	);
}

export function PhoneField(props: {
	showPhoneField: boolean;
	touched: Record<string, boolean>;
	errors: Record<string, string>;
	phone: string;
	phoneRef: RefObject<HTMLInputElement | null>;
	prefersReducedMotion: boolean;
	onPhoneChange: (value: string) => void;
	onBlur: (field: string) => void;
}) {
	const {
		showPhoneField,
		touched,
		errors,
		phone,
		phoneRef,
		prefersReducedMotion,
		onPhoneChange,
		onBlur,
	} = props;
	if (!showPhoneField) return null;

	return (
		<motion.div
			className={`rsvp__field ${touched.phone && errors.phone ? 'rsvp__field--error' : ''}`}
			initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
			whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
			viewport={prefersReducedMotion ? undefined : { once: true }}
			transition={prefersReducedMotion ? undefined : { delay: 0.05 }}
		>
			<label htmlFor="phone">Teléfono de contacto *</label>
			<input
				ref={phoneRef}
				type="tel"
				id="phone"
				inputMode="numeric"
				autoComplete="tel"
				placeholder="10 dígitos"
				value={phone}
				onChange={(e) => onPhoneChange(e.target.value)}
				onBlur={() => onBlur('phone')}
				aria-invalid={!!(touched.phone && errors.phone)}
				aria-describedby={touched.phone && errors.phone ? 'phone-error' : undefined}
			/>
			{touched.phone && errors.phone && (
				<p className="rsvp__field-error" id="phone-error" role="alert">
					{errors.phone}
				</p>
			)}
		</motion.div>
	);
}

export function AttendanceField(props: {
	touched: Record<string, boolean>;
	errors: Record<string, string>;
	attendanceLabel: string;
	attendanceStatus: AttendanceStatus;
	attendanceRef: RefObject<HTMLDivElement | null>;
	prefersReducedMotion: boolean;
	onAttendanceChange: (status: Exclude<AttendanceStatus, null>) => void;
	onBlur: (field: string) => void;
}) {
	const {
		touched,
		errors,
		attendanceLabel,
		attendanceStatus,
		attendanceRef,
		prefersReducedMotion,
		onAttendanceChange,
		onBlur,
	} = props;

	return (
		<motion.fieldset
			className={`rsvp__field rsvp__fieldset ${
				touched.attendance && errors.attendance ? 'rsvp__field--error' : ''
			}`}
			initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
			whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
			viewport={prefersReducedMotion ? undefined : { once: true }}
			transition={prefersReducedMotion ? undefined : { delay: 0.1 }}
		>
			<legend className="rsvp__legend">{attendanceLabel}</legend>
			<div className="rsvp__radio-group" ref={attendanceRef}>
				<label htmlFor="attendance-yes">
					<input
						type="radio"
						id="attendance-yes"
						name="attendance"
						checked={attendanceStatus === 'confirmed'}
						onChange={() => onAttendanceChange('confirmed')}
						onBlur={() => onBlur('attendance')}
					/>
					Sí, asistiré
				</label>
				<label htmlFor="attendance-no">
					<input
						type="radio"
						id="attendance-no"
						name="attendance"
						checked={attendanceStatus === 'declined'}
						onChange={() => onAttendanceChange('declined')}
						onBlur={() => onBlur('attendance')}
					/>
					No podré asistir
				</label>
			</div>
			{touched.attendance && errors.attendance && (
				<p className="rsvp__field-error" role="alert">
					{errors.attendance}
				</p>
			)}
		</motion.fieldset>
	);
}

export function ConfirmedFields(props: {
	attendanceStatus: AttendanceStatus;
	prefersReducedMotion: boolean;
	supportsPlusOnes: boolean;
	touched: Record<string, boolean>;
	errors: Record<string, string>;
	guestCountLabel: string;
	effectiveGuestCap: number;
	guestCountRef: RefObject<HTMLInputElement | null>;
	attendeeCount: number | string;
	notes: string;
	onGuestCountChange: (value: string) => void;
	onNotesChange: (value: string) => void;
	onBlur: (field: string) => void;
}) {
	const {
		attendanceStatus,
		prefersReducedMotion,
		supportsPlusOnes,
		touched,
		errors,
		guestCountLabel,
		effectiveGuestCap,
		guestCountRef,
		attendeeCount,
		notes,
		onGuestCountChange,
		onNotesChange,
		onBlur,
	} = props;

	if (attendanceStatus !== 'confirmed') return null;

	return (
		<AnimatePresence>
			<motion.div
				initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
				animate={{ opacity: 1, height: 'auto' }}
				exit={
					prefersReducedMotion
						? { opacity: 1, height: 'auto' }
						: { opacity: 0, height: 0 }
				}
				transition={prefersReducedMotion ? { duration: 0 } : undefined}
				className="rsvp__extra-fields"
			>
				{supportsPlusOnes && (
					<div
						className={`rsvp__field ${
							touched.guestCount && errors.guestCount ? 'rsvp__field--error' : ''
						}`}
					>
						<label htmlFor="guestCount">
							{guestCountLabel}
							{effectiveGuestCap <= 10 ? ` (M\u00e1x. ${effectiveGuestCap})` : ''}
						</label>
						<input
							ref={guestCountRef}
							type="number"
							id="guestCount"
							min="1"
							max={effectiveGuestCap}
							value={attendeeCount}
							onChange={(e) => onGuestCountChange(e.target.value)}
							onBlur={() => onBlur('guestCount')}
						/>
						{touched.guestCount && errors.guestCount && (
							<p className="rsvp__field-error" role="alert">
								{errors.guestCount}
							</p>
						)}
					</div>
				)}
				<div className="rsvp__field">
					<label htmlFor="notes">Notas adicionales</label>
					<textarea
						id="notes"
						placeholder="Alguna nota para nosotros..."
						rows={2}
						value={notes}
						onChange={(e) => onNotesChange(e.target.value)}
					/>
				</div>
			</motion.div>
		</AnimatePresence>
	);
}
