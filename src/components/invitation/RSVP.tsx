import React, { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { rsvpApi } from '@/lib/client/rsvp-api';
import '@/styles/invitation/_rsvp.scss';
import {
	resolveLabels,
	normalizeGuestCount,
	buildWhatsAppUrl,
	validateRsvpForm,
	LockedPreview,
	SubmittedState,
	RsvpFormView,
	type AttendanceStatus,
	type WhatsAppConfig,
} from './RSVPComponents';

interface RSVPProps {
	title: string;
	celebrantName?: string;
	guestCap: number;
	confirmationMessage: string;
	labels?: {
		name?: string;
		guestCount?: string;
		attendance?: string;
		confirmButton?: string;
	};
	showDietaryField?: boolean;
	dietaryLabel?: string;
	dietaryPlaceholder?: string;
	variant?: string;
	confirmationMode?: 'api' | 'whatsapp' | 'both';
	whatsappConfig?: WhatsAppConfig;
	initialGuestData?: {
		fullName?: string;
		maxAllowedAttendees?: number;
		inviteId?: string;
	};
}

const RSVP: React.FC<RSVPProps> = ({
	title,
	celebrantName,
	guestCap,
	confirmationMessage,
	labels,
	showDietaryField = false,
	dietaryLabel = 'Alergias o restricciones alimentarias',
	dietaryPlaceholder = 'Ej. Vegetariano, alergia al man\u00ed...',
	variant,
	confirmationMode = 'api',
	whatsappConfig,
	initialGuestData,
}) => {
	const prefersReducedMotion = useReducedMotion();
	const hasPersonalizedInvite = Boolean(initialGuestData?.inviteId);

	const [name, setName] = useState(initialGuestData?.fullName || '');
	const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(null);
	const [attendeeCount, setAttendeeCount] = useState<number | string>(1);
	const [notes, setNotes] = useState('');
	const [dietary, setDietary] = useState('');
	const [nameLocked, setNameLocked] = useState(!!initialGuestData?.fullName);
	const [contextGuestCap, setContextGuestCap] = useState<number>(
		Number(initialGuestData?.maxAllowedAttendees || guestCap),
	);
	const [rsvpId, setRsvpId] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
		'idle',
	);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	const nameRef = useRef<HTMLInputElement>(null);
	const attendanceRef = useRef<HTMLDivElement>(null);
	const guestCountRef = useRef<HTMLInputElement>(null);

	const effectiveGuestCap = Math.max(1, Number(contextGuestCap || guestCap));
	const supportsPlusOnes = effectiveGuestCap > 1;
	const labels_resolved = resolveLabels(labels);

	const showWhatsAppCta =
		submitted &&
		attendanceStatus === 'confirmed' &&
		(confirmationMode === 'both' || confirmationMode === 'whatsapp') &&
		!!whatsappConfig?.phone;

	useEffect(() => {
		if (initialGuestData) {
			if (initialGuestData.fullName) {
				setName(initialGuestData.fullName);
				setNameLocked(true);
			}
			if (initialGuestData.maxAllowedAttendees) {
				setContextGuestCap(initialGuestData.maxAllowedAttendees);
			}
		} else {
			setNameLocked(false);
		}
	}, [initialGuestData]);

	const validate = () => {
		const newErrors = validateRsvpForm({
			name,
			nameLocked,
			attendanceStatus,
			attendeeCount,
			supportsPlusOnes,
			effectiveGuestCap,
		});
		setErrors(newErrors);
		return newErrors;
	};

	const handleBlur = (field: string) => {
		setTouched((prev) => ({ ...prev, [field]: true }));
		validate();
	};

	const handleSubmit = async (e: SyntheticEvent) => {
		e.preventDefault();
		setSubmitStatus('loading');

		const validationErrors = validate();
		const errorKeys = Object.keys(validationErrors);

		if (errorKeys.length > 0) {
			setSubmitStatus('error');
			setTouched({
				name: true,
				attendance: true,
				guestCount: true,
			});

			const firstError = errorKeys[0];

			const refMap: Record<string, React.RefObject<HTMLElement | null>> = {
				name: nameRef as React.RefObject<HTMLElement | null>,
				attendance: attendanceRef as React.RefObject<HTMLElement | null>,
				guestCount: guestCountRef as React.RefObject<HTMLElement | null>,
			};

			const targetRef = refMap[firstError];
			if (targetRef?.current) {
				targetRef.current.scrollIntoView({
					behavior: prefersReducedMotion ? 'auto' : 'smooth',
					block: 'center',
				});

				if (firstError === 'attendance') {
					const firstRadio = targetRef.current.querySelector(
						'input[type="radio"]',
					) as HTMLInputElement | null;
					firstRadio?.focus();
				} else {
					(targetRef.current as HTMLElement).focus();
				}
			}

			return;
		}

		setIsSubmitting(true);

		try {
			const normalizedCount = normalizeGuestCount(
				attendanceStatus,
				attendeeCount,
				supportsPlusOnes,
			);

			if (!initialGuestData?.inviteId) {
				setSubmitStatus('error');
				setErrors((prev) => ({
					...prev,
					global: 'Esta invitaci\u00f3n requiere un enlace personalizado.',
				}));
				return;
			}

			const payload = {
				attendanceStatus: attendanceStatus as 'confirmed' | 'declined',
				attendeeCount: normalizedCount,
				guestMessage: notes,
			};

			const data = await rsvpApi.submitRsvp(initialGuestData.inviteId, payload);
			if (data.rsvpId) setRsvpId(data.rsvpId);

			setSubmitStatus('success');
			setTimeout(() => setSubmitted(true), 500);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'No se pudo conectar con el servidor.';
			setSubmitStatus('error');
			setErrors((prev) => ({ ...prev, global: message }));
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleWhatsAppClick = async () => {
		if (!rsvpId) return;
		try {
			await rsvpApi.trackAction(rsvpId, 'clicked', 'whatsapp');
		} catch {
			// telemetry
		}
	};

	if (!hasPersonalizedInvite) {
		return <LockedPreview title={title} variant={variant} />;
	}

	if (submitted) {
		return (
			<SubmittedState
				title={title}
				variant={variant}
				name={name}
				attendanceStatus={attendanceStatus}
				confirmationMessage={confirmationMessage}
				celebrantName={celebrantName}
				showWhatsAppCta={showWhatsAppCta}
				whatsAppUrl={buildWhatsAppUrl({
					whatsappConfig,
					attendanceStatus,
					attendeeCount,
					name,
					title,
				})}
				onWhatsAppClick={() => {
					void handleWhatsAppClick();
				}}
			/>
		);
	}

	return (
		<RsvpFormView
			title={title}
			variant={variant}
			prefersReducedMotion={Boolean(prefersReducedMotion)}
			nameLocked={nameLocked}
			nameLabel={labels_resolved.nameLabel}
			guestCountLabel={labels_resolved.guestCountLabel}
			attendanceLabel={labels_resolved.attendanceLabel}
			buttonLabel={labels_resolved.buttonLabel}
			name={name}
			touched={touched}
			errors={errors}
			attendanceStatus={attendanceStatus}
			supportsPlusOnes={supportsPlusOnes}
			effectiveGuestCap={effectiveGuestCap}
			attendeeCount={attendeeCount}
			showDietaryField={showDietaryField}
			dietaryLabel={dietaryLabel}
			dietaryPlaceholder={dietaryPlaceholder}
			dietary={dietary}
			notes={notes}
			isSubmitting={isSubmitting}
			submitStatus={submitStatus}
			nameRef={nameRef}
			attendanceRef={attendanceRef}
			guestCountRef={guestCountRef}
			onSubmit={handleSubmit}
			onNameChange={(value) => {
				setName(value);
				if (touched.name) validate();
			}}
			onAttendanceChange={(status) => {
				setAttendanceStatus(status);
				setAttendeeCount(status === 'declined' ? 0 : supportsPlusOnes ? attendeeCount : 1);
				if (touched.attendance) validate();
			}}
			onGuestCountChange={(value) => {
				setAttendeeCount(value);
				if (touched.guestCount) validate();
			}}
			onDietaryChange={setDietary}
			onNotesChange={setNotes}
			onBlur={handleBlur}
		/>
	);
};

export default RSVP;
