import { useReducedMotion, AnimatePresence, motion } from 'framer-motion';
import { useRsvpSubmission } from '@/hooks/use-rsvp-submission';
import '@/styles/invitation/_rsvp.scss';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import {
	resolveLabels,
	buildWhatsAppUrl,
	LockedPreview,
	SubmittedState,
	RsvpFormView,
	type WhatsAppConfig,
} from '@/components/invitation/RSVPComponents';

interface RSVPProps {
	eventType: EventRecord['eventType'];
	eventSlug: string;
	title: string;
	celebrantName?: string;
	guestCap: number;
	accessMode: 'personalized-only' | 'hybrid';
	confirmationMessage: string;
	labels?: {
		name?: string;
		guestCount?: string;
		attendance?: string;
		confirmButton?: string;
		phone?: string;
	};
	variant?: string;
	confirmationMode?: 'api' | 'whatsapp' | 'both';
	whatsappConfig?: WhatsAppConfig;
	initialGuestData?: {
		fullName?: string;
		maxAllowedAttendees?: number;
		inviteId?: string;
	};
	isDemoPreview?: boolean;
}

const RSVP: React.FC<RSVPProps> = ({
	eventType,
	eventSlug,
	title,
	celebrantName,
	guestCap,
	accessMode,
	confirmationMessage,
	labels,
	variant,
	confirmationMode = 'api',
	whatsappConfig,
	initialGuestData,
	isDemoPreview,
}) => {
	const prefersReducedMotion = useReducedMotion();
	const hasPersonalizedInvite = Boolean(initialGuestData?.inviteId);
	const allowPublicRsvp = !hasPersonalizedInvite && accessMode === 'hybrid';

	const {
		name,
		phone,
		countryCode,
		showPhoneField,
		attendanceStatus,
		attendeeCount,
		notes,
		nameLocked,
		effectiveGuestCap,
		supportsPlusOnes,
		isSubmitting,
		submitted,
		submitStatus,
		errors,
		touched,
		nameRef,
		phoneRef,
		attendanceRef,
		guestCountRef,
		setName,
		setCountryCode,
		handlePhoneChange,
		setAttendanceStatus,
		setAttendeeCount,
		setNotes,
		handleBlur,
		handleSubmit,
		handleWhatsAppClick,
		validate,
	} = useRsvpSubmission({
		guestCap,
		eventType,
		eventSlug,
		accessMode,
		initialGuestData,
		prefersReducedMotion: !!prefersReducedMotion,
		isDemoPreview,
	});
	const labelsResolved = resolveLabels(labels, celebrantName);
	const showWhatsAppCta =
		submitted &&
		attendanceStatus === 'confirmed' &&
		(confirmationMode === 'both' || confirmationMode === 'whatsapp') &&
		Boolean(whatsappConfig?.phone);

	if (!hasPersonalizedInvite && !allowPublicRsvp && !isDemoPreview) {
		return <LockedPreview title={title} variant={variant} />;
	}

	return (
		<AnimatePresence mode="wait">
			{submitted ? (
				<motion.div
					key="rsvp-success"
					initial={prefersReducedMotion ? undefined : { opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
					transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
				>
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
				</motion.div>
			) : (
				<motion.div
					key="rsvp-form"
					initial={prefersReducedMotion ? undefined : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
					transition={{ duration: 0.5 }}
				>
					<RsvpFormView
						title={title}
						variant={variant}
						prefersReducedMotion={!!prefersReducedMotion}
						nameLocked={nameLocked}
						nameLabel={labelsResolved.nameLabel}
						guestCountLabel={labelsResolved.guestCountLabel}
						attendanceLabel={labelsResolved.attendanceLabel}
						buttonLabel={labelsResolved.buttonLabel}
						phoneLabel={labelsResolved.phoneLabel}
						notesLabel={labelsResolved.notesLabel}
						notesPlaceholder={labelsResolved.notesPlaceholder}
						name={name}
						phone={phone}
						countryCode={countryCode}
						showPhoneField={showPhoneField}
						touched={touched}
						errors={errors}
						attendanceStatus={attendanceStatus}
						supportsPlusOnes={supportsPlusOnes}
						effectiveGuestCap={effectiveGuestCap}
						attendeeCount={attendeeCount}
						notes={notes}
						isSubmitting={isSubmitting}
						submitStatus={submitStatus}
						nameRef={nameRef}
						phoneRef={phoneRef}
						attendanceRef={attendanceRef}
						guestCountRef={guestCountRef}
						isDemoPreview={isDemoPreview}
						onSubmit={handleSubmit}
						onNameChange={(value) => {
							setName(value);
							if (touched.name) validate();
						}}
						onPhoneChange={(value) => {
							handlePhoneChange(value);
							if (touched.phone) validate();
						}}
						onCountryCodeChange={(value) => {
							setCountryCode(value);
							if (touched.phone) validate();
						}}
						onAttendanceChange={(status) => {
							setAttendanceStatus(status);
							setAttendeeCount(
								status === 'declined' ? 0 : supportsPlusOnes ? attendeeCount : 1,
							);
							if (touched.attendance) validate();
						}}
						onGuestCountChange={(value) => {
							setAttendeeCount(value);
							if (touched.guestCount) validate();
						}}
						onNotesChange={setNotes}
						onBlur={handleBlur}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export default RSVP;
