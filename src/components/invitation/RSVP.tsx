import { useReducedMotion, AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef } from 'react';
import { useRsvpSubmission } from '@/hooks/use-rsvp-submission';
import { getSmartScrollBlock } from '@/lib/dom/viewport';
import '@/styles/invitation/_rsvp.scss';

import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import {
	resolveLabels,
	buildWhatsAppUrl,
	normalizeGuestCount,
	getDefaultRsvpSubcopy,
	LockedPreview,
	SubmittedState,
	RsvpFormView,
	type WhatsAppConfig,
} from '@/components/invitation/RSVPComponents';

interface RSVPProps {
	eventType: EventRecord['eventType'];
	eventSlug: string;
	subcopy?: string;
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

/* ------------------------------------------------------------------ */
/*  RSVP section-scroll helper                                          */
/*  Uses window.scrollTo to bypass global scroll-padding-top on :root   */
/*  so the RSVP section aligns flush to the viewport top.               */
/* ------------------------------------------------------------------ */

function scrollSectionToViewportTop(
	section: HTMLElement,
	behavior: ScrollBehavior = 'smooth',
): void {
	const top = window.scrollY + section.getBoundingClientRect().top;

	window.scrollTo({ top, behavior });
}

/* ------------------------------------------------------------------ */
/*  RSVP component                                                      */
/* ------------------------------------------------------------------ */

const RSVP: React.FC<RSVPProps> = ({
	eventType,
	eventSlug,
	subcopy,
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
	const successRef = useRef<HTMLElement>(null);
	const sectionRef = useRef<HTMLElement>(null);

	const {
		name,
		phone,
		countryCode,
		showPhoneField,
		isPersonalized,
		isPublicRsvp,
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
	const showIdentityFields = isPublicRsvp
		? attendanceStatus !== null && !nameLocked
		: !nameLocked;
	const labelsResolved = resolveLabels(labels, celebrantName, variant);
	const resolvedSubcopy = subcopy ?? getDefaultRsvpSubcopy(eventType);
	const showWhatsAppCta =
		submitted &&
		attendanceStatus === 'confirmed' &&
		(confirmationMode === 'both' || confirmationMode === 'whatsapp') &&
		Boolean(whatsappConfig?.phone);

	/* ----- field-level scroll (text inputs) ----- */
	const scrollIntoViewSmart = useCallback(
		(element: HTMLElement) => {
			element.scrollIntoView({
				behavior: prefersReducedMotion ? 'auto' : 'smooth',
				block: getSmartScrollBlock(element),
				inline: 'nearest',
			});
		},
		[prefersReducedMotion],
	);

	const handleFocusCapture = useCallback(
		(e: React.FocusEvent<HTMLElement>) => {
			const target = e.target as HTMLElement;
			const isTextInput = target.matches(
				'input[type="text"], input[type="tel"], input[type="number"], textarea',
			);

			if (isTextInput) {
				const field = target.closest('.rsvp__field') as HTMLElement | null;
				if (field) scrollIntoViewSmart(field);
			}
		},
		[scrollIntoViewSmart],
	);

	/* ----- post-hydration hash correction + post-load recheck + hash change listener ----- */
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const doHashCorrection = (): void => {
			if (window.location.hash !== '#rsvp') return;
			const section = sectionRef.current;
			if (!section) return;

			requestAnimationFrame(() => {
				scrollSectionToViewportTop(section, prefersReducedMotion ? 'auto' : 'smooth');
			});
		};

		doHashCorrection();

		// One recheck after all assets (images, fonts) have loaded,
		// in case lazy content shifted the layout after the initial scroll.
		const onLoad = (): void => {
			doHashCorrection();
		};

		if (document.readyState === 'complete') {
			onLoad();
		} else {
			window.addEventListener('load', onLoad, { once: true });
		}

		window.addEventListener('hashchange', doHashCorrection);

		return () => {
			window.removeEventListener('hashchange', doHashCorrection);
			window.removeEventListener('load', onLoad);
		};
	}, [prefersReducedMotion]);

	/* ----- success scroll ----- */
	useEffect(() => {
		if (!submitted || !successRef.current) return;

		successRef.current.focus({ preventScroll: true });
		scrollSectionToViewportTop(successRef.current, prefersReducedMotion ? 'auto' : 'smooth');
	}, [submitted, prefersReducedMotion]);

	/* ----- render paths ----- */
	if (!isPersonalized && !isPublicRsvp) {
		return <LockedPreview title={title} variant={variant} />;
	}

	/* ----- track attendance transitions ----- */
	const handleAttendanceChange = useCallback(
		(status: 'confirmed' | 'declined') => {
			setAttendanceStatus(status);
			setAttendeeCount(
				normalizeGuestCount(status, attendeeCount, supportsPlusOnes, effectiveGuestCap),
			);
			if (touched.attendance) validate();
		},
		[attendeeCount, effectiveGuestCap, supportsPlusOnes, touched.attendance, validate],
	);

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
						ref={successRef}
						title={title}
						variant={variant}
						modifier="rsvp--expanded"
						onFocusCapture={handleFocusCapture}
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
						ref={sectionRef}
						title={title}
						subcopy={resolvedSubcopy}
						variant={variant}
						modifier="rsvp--expanded"
						onFocusCapture={handleFocusCapture}
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
						showIdentityFields={showIdentityFields}
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
						onAttendanceChange={handleAttendanceChange}
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
