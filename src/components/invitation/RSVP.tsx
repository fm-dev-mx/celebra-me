import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { useRsvpSubmission } from '@/hooks/use-rsvp-submission';
import '@/styles/invitation/_rsvp.scss';
import {
	resolveLabels,
	buildWhatsAppUrl,
	LockedPreview,
	SubmittedState,
	RsvpFormView,
	type WhatsAppConfig,
} from '@/components/invitation/RSVPComponents';

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
	const {
		name,
		attendanceStatus,
		attendeeCount,
		notes,
		dietary,
		nameLocked,
		effectiveGuestCap,
		supportsPlusOnes,
		isSubmitting,
		submitted,
		submitStatus,
		errors,
		touched,
		nameRef,
		attendanceRef,
		guestCountRef,
		setName,
		setAttendanceStatus,
		setAttendeeCount,
		setNotes,
		setDietary,
		handleBlur,
		handleSubmit,
		handleWhatsAppClick,
		validate,
	} = useRsvpSubmission({
		guestCap,
		initialGuestData,
		prefersReducedMotion: Boolean(prefersReducedMotion),
	});
	const labels_resolved = resolveLabels(labels);
	const showWhatsAppCta =
		submitted &&
		attendanceStatus === 'confirmed' &&
		(confirmationMode === 'both' || confirmationMode === 'whatsapp') &&
		Boolean(whatsappConfig?.phone);

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
