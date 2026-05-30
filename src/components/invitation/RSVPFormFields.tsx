import { motion } from 'framer-motion';
import type { RefObject } from 'react';
import { type AttendanceStatus } from '@/components/invitation/rsvp-logic';
import { COUNTRY_OPTIONS } from '@/lib/phone/country-codes';

const FIELD_ANIMATION_BASE_DELAY = 0.05;
const FIELD_ANIMATION_STEP = 0.05;

interface FloatingFieldProps {
	id: string;
	type: 'text' | 'tel' | 'number';
	inputMode?: 'numeric' | 'text' | 'tel' | undefined;
	autoComplete?: string;
	label: string;
	labelSuffix?: string;
	value: string | number;
	placeholder?: string;
	error: string | undefined;
	touched: boolean;
	prefersReducedMotion: boolean;
	fieldRef: RefObject<HTMLInputElement | null>;
	onChange: (value: string) => void;
	onBlur: (field: string) => void;
	delayIndex?: number;
	min?: number;
	max?: number;
}

function FloatingField({
	id,
	type,
	inputMode,
	autoComplete,
	label,
	labelSuffix,
	value,
	placeholder,
	error,
	touched,
	prefersReducedMotion,
	fieldRef,
	onChange,
	onBlur,
	delayIndex = 0,
	min,
	max,
}: FloatingFieldProps) {
	const hasError = touched && error;
	return (
		<motion.div
			className={`rsvp__field ${hasError ? 'rsvp__field--error' : ''} ${
				value ? 'rsvp__field--has-value' : ''
			}`}
			initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
			whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
			viewport={prefersReducedMotion ? undefined : { once: true }}
			transition={
				prefersReducedMotion
					? undefined
					: { delay: FIELD_ANIMATION_BASE_DELAY + delayIndex * FIELD_ANIMATION_STEP }
			}
		>
			<label htmlFor={id} className="rsvp__label">
				{label}
				{labelSuffix}
			</label>
			<input
				ref={fieldRef}
				type={type}
				id={id}
				inputMode={inputMode}
				autoComplete={autoComplete}
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onBlur={() => onBlur(id)}
				aria-invalid={!!hasError}
				aria-describedby={hasError ? `${id}-error` : undefined}
				suppressHydrationWarning
				min={min}
				max={max}
			/>
			<div className="rsvp__field-line" />
			{hasError && (
				<p className="rsvp__field-error" id={`${id}-error`} role="alert">
					{error}
				</p>
			)}
		</motion.div>
	);
}

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
		<FloatingField
			id="name"
			type="text"
			label={nameLabel}
			value={name}
			error={errors.name}
			touched={touched.name}
			prefersReducedMotion={prefersReducedMotion}
			fieldRef={nameRef}
			onChange={onNameChange}
			onBlur={onBlur}
			delayIndex={0}
		/>
	);
}

export function PhoneField(props: {
	showPhoneField: boolean;
	touched: Record<string, boolean>;
	errors: Record<string, string>;
	phoneLabel: string;
	phone: string;
	countryCode: string;
	phoneRef: RefObject<HTMLInputElement | null>;
	prefersReducedMotion: boolean;
	onPhoneChange: (value: string) => void;
	onCountryCodeChange: (value: string) => void;
	onBlur: (field: string) => void;
}) {
	const {
		showPhoneField,
		touched,
		errors,
		phoneLabel,
		phone,
		countryCode,
		phoneRef,
		prefersReducedMotion,
		onPhoneChange,
		onCountryCodeChange,
		onBlur,
	} = props;
	if (!showPhoneField) return null;

	return (
		<motion.div
			className={`rsvp__field rsvp__field--phone ${
				touched.phone && errors.phone ? 'rsvp__field--error' : ''
			}`}
			initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
			whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
			viewport={prefersReducedMotion ? undefined : { once: true }}
			transition={prefersReducedMotion ? undefined : { delay: 0.1 }}
		>
			<label htmlFor="phone" className="rsvp__label">
				{phoneLabel}
			</label>
			<div className="rsvp__phone-group">
				<select
					className="rsvp__country-code"
					value={countryCode}
					onChange={(e) => onCountryCodeChange(e.target.value)}
					onBlur={() => onBlur('phone')}
					aria-label="Código de país"
				>
					{COUNTRY_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
				<div className="rsvp__phone-input-wrapper">
					<input
						ref={phoneRef}
						type="tel"
						id="phone"
						inputMode="numeric"
						autoComplete="tel"
						placeholder=""
						value={phone}
						onChange={(e) => onPhoneChange(e.target.value)}
						onBlur={() => onBlur('phone')}
						aria-invalid={!!(touched.phone && errors.phone)}
						aria-describedby={touched.phone && errors.phone ? 'phone-error' : undefined}
						suppressHydrationWarning
					/>
					<div className="rsvp__field-line" />
				</div>
			</div>
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
				<label htmlFor="attendance-yes" className="rsvp__radio-card">
					<input
						type="radio"
						id="attendance-yes"
						name="attendance"
						checked={attendanceStatus === 'confirmed'}
						onChange={() => onAttendanceChange('confirmed')}
						onBlur={() => onBlur('attendance')}
						className="sr-only"
						suppressHydrationWarning
					/>
					<span className="rsvp__radio-indicator" />
					<span className="rsvp__radio-label">Sí, asistiré</span>
				</label>
				<label htmlFor="attendance-no" className="rsvp__radio-card">
					<input
						type="radio"
						id="attendance-no"
						name="attendance"
						checked={attendanceStatus === 'declined'}
						onChange={() => onAttendanceChange('declined')}
						onBlur={() => onBlur('attendance')}
						className="sr-only"
						suppressHydrationWarning
					/>
					<span className="rsvp__radio-indicator" />
					<span className="rsvp__radio-label">No podré</span>
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
	notesLabel: string;
	notesPlaceholder: string;
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
		notesLabel,
		notesPlaceholder,
		onGuestCountChange,
		onNotesChange,
		onBlur,
	} = props;

	const isExpanded = attendanceStatus !== null;

	return (
		<div
			className={`rsvp__extra-fields${isExpanded ? ' rsvp__extra-fields--expanded' : ''}`}
			aria-hidden={!isExpanded}
		>
			<div className="rsvp__extra-fields-inner">
				{attendanceStatus === 'confirmed' && supportsPlusOnes && (
					<FloatingField
						id="guestCount"
						type="number"
						label={guestCountLabel}
						labelSuffix={effectiveGuestCap <= 10 ? ` (Máx. ${effectiveGuestCap})` : ''}
						value={String(attendeeCount)}
						error={errors.guestCount}
						touched={touched.guestCount}
						prefersReducedMotion={prefersReducedMotion}
						fieldRef={guestCountRef}
						onChange={onGuestCountChange}
						onBlur={onBlur}
						min={1}
						max={effectiveGuestCap}
					/>
				)}
				<div className="rsvp__field">
					<label htmlFor="notes">{notesLabel}</label>
					<textarea
						id="notes"
						placeholder={notesPlaceholder}
						rows={2}
						value={notes}
						onChange={(e) => onNotesChange(e.target.value)}
						disabled={!isExpanded}
					/>
				</div>
			</div>
		</div>
	);
}
