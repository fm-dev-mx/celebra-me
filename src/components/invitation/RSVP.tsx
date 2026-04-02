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
	};
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
}) => {
	const prefersReducedMotion = useReducedMotion();
	const hasPersonalizedInvite = Boolean(initialGuestData?.inviteId);
	const allowPublicRsvp = !hasPersonalizedInvite && accessMode === 'hybrid';
	const {
		name,
		phone,
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
		setPhone,
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
		prefersReducedMotion: Boolean(prefersReducedMotion),
	});
	const labels_resolved = resolveLabels(labels);
	const showWhatsAppCta =
		submitted &&
		attendanceStatus === 'confirmed' &&
		(confirmationMode === 'both' || confirmationMode === 'whatsapp') &&
		Boolean(whatsappConfig?.phone);

	if (!hasPersonalizedInvite && !allowPublicRsvp) {
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
						prefersReducedMotion={Boolean(prefersReducedMotion)}
						nameLocked={nameLocked}
						nameLabel={labels_resolved.nameLabel}
						guestCountLabel={labels_resolved.guestCountLabel}
						attendanceLabel={labels_resolved.attendanceLabel}
						buttonLabel={labels_resolved.buttonLabel}
						phoneLabel={labels_resolved.phoneLabel}
						name={name}
						phone={phone}
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
						onSubmit={handleSubmit}
						onNameChange={(value) => {
							setName(value);
							if (touched.name) validate();
						}}
						onPhoneChange={(value) => {
							setPhone(value);
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
