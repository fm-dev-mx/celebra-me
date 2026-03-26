import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type AttendanceStatus } from './rsvp-logic';

export function NameField(props: {
	nameLocked: boolean;
	touched: Record<string, boolean>;
	errors: Record<string, string>;
	nameLabel: string;
	name: string;
	nameRef: React.RefObject<HTMLInputElement | null>;
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

export function AttendanceField(props: {
	touched: Record<string, boolean>;
	errors: Record<string, string>;
	attendanceLabel: string;
	attendanceStatus: AttendanceStatus;
	attendanceRef: React.RefObject<HTMLDivElement | null>;
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
	guestCountRef: React.RefObject<HTMLInputElement | null>;
	attendeeCount: number | string;
	showDietaryField: boolean;
	dietaryLabel: string;
	dietaryPlaceholder: string;
	dietary: string;
	notes: string;
	onGuestCountChange: (value: string) => void;
	onDietaryChange: (value: string) => void;
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
		showDietaryField,
		dietaryLabel,
		dietaryPlaceholder,
		dietary,
		notes,
		onGuestCountChange,
		onDietaryChange,
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
				{showDietaryField && (
					<div className="rsvp__field">
						<label htmlFor="dietary">{dietaryLabel}</label>
						<textarea
							id="dietary"
							placeholder={dietaryPlaceholder}
							rows={2}
							value={dietary}
							onChange={(e) => onDietaryChange(e.target.value)}
						/>
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
