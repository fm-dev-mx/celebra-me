import { useReducedMotion, AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRsvpSubmission } from '@/hooks/use-rsvp-submission';
import { rsvpApi } from '@/lib/client/rsvp-api';
import { getCardAwareScrollTop } from '@/lib/dom/viewport';
import '@/styles/invitation/_rsvp.scss';

import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import type { RsvpResponseMessages } from '@/components/invitation/rsvp-logic';
import {
	resolveLabels,
	buildWhatsAppUrl,
	getDefaultRsvpSubcopy,
	LockedPreview,
	SubmittedState,
	RsvpFormView,
	type WhatsAppConfig,
	type RevealedLocation,
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
	responseMessages?: RsvpResponseMessages;
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
		attendanceStatus?: 'pending' | 'confirmed' | 'declined';
		attendeeCount?: number;
		guestComment?: string;
	};
	isDemoPreview?: boolean;
	revealedLocation?: RevealedLocation;
	enableResponseEditing?: boolean;
}

/* ------------------------------------------------------------------ */
/*  RSVP card-scroll helper                                             */
/*  Positions the card inside the actual visible area after fixed UI.    */
/* ------------------------------------------------------------------ */

function readCssPixelValue(value: string): number {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function getFixedRsvpOffsets(): {
	headerHeight: number;
	playerClearance: number;
	safeAreaInsetBottom: number;
} {
	const rootStyles = getComputedStyle(document.documentElement);
	const configuredHeader = readCssPixelValue(
		rootStyles.getPropertyValue('--nav-current-height') ||
			rootStyles.getPropertyValue('--invitation-header-height'),
	);
	const header = document.querySelector<HTMLElement>('#event-header');
	const headerRect = header?.getBoundingClientRect();
	const headerHeight =
		headerRect && headerRect.bottom > 0
			? Math.max(configuredHeader, headerRect.bottom)
			: configuredHeader;
	const player = document.querySelector<HTMLElement>('[data-music-player]');
	const playerRect = player?.getBoundingClientRect();
	const playerClearance = playerRect ? Math.max(0, window.innerHeight - playerRect.top) : 0;

	return {
		headerHeight,
		playerClearance,
		safeAreaInsetBottom: readCssPixelValue(
			rootStyles.getPropertyValue('--rsvp-safe-area-bottom'),
		),
	};
}

function scrollRsvpCardIntoView(target: HTMLElement, behavior: ScrollBehavior = 'smooth'): void {
	const section = target.closest('.rsvp-section') as HTMLElement | null;
	const card = section?.querySelector<HTMLElement>('.rsvp');
	const scrollTarget = card ?? section ?? target;
	const top = getCardAwareScrollTop(scrollTarget, getFixedRsvpOffsets());

	window.scrollTo({ top: Math.max(0, top), behavior });
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
	responseMessages,
	labels,
	variant,
	confirmationMode = 'api',
	whatsappConfig,
	initialGuestData,
	isDemoPreview,
	revealedLocation,
	enableResponseEditing = false,
}) => {
	const prefersReducedMotion = useReducedMotion();
	const successRef = useRef<HTMLDivElement>(null);
	const sectionRef = useRef<HTMLElement>(null);
	const locationFetchAttemptedRef = useRef(false);
	const [isEditingResponse, setIsEditingResponse] = useState(false);

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
		startEditingResponse,
		restoreInitialResponse,
		responseInviteId,
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
	const locationInviteId = initialGuestData?.inviteId || responseInviteId;

	/* ----- scheduled RSVP recenter ----- */
	const recenterRef = useRef<number | null>(null);

	const scheduleRsvpRecenter = useCallback(() => {
		window.dispatchEvent(new CustomEvent('celebrame:close-navigation'));

		if (recenterRef.current !== null) {
			cancelAnimationFrame(recenterRef.current);
		}

		recenterRef.current = requestAnimationFrame(() => {
			recenterRef.current = requestAnimationFrame(() => {
				const section = sectionRef.current;
				if (section) {
					scrollRsvpCardIntoView(section, prefersReducedMotion ? 'auto' : 'smooth');
				}
				recenterRef.current = null;
			});
		});
	}, [prefersReducedMotion]);

	/* ----- post-hydration hash correction + post-load recheck + hash change listener ----- */
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const doHashCorrection = (): void => {
			if (window.location.hash !== '#rsvp') return;
			const section = sectionRef.current;
			if (!section) return;

			requestAnimationFrame(() => {
				scrollRsvpCardIntoView(section, prefersReducedMotion ? 'auto' : 'smooth');
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

		setIsEditingResponse(false);
		successRef.current.focus({ preventScroll: true });
		scrollRsvpCardIntoView(successRef.current, prefersReducedMotion ? 'auto' : 'smooth');
	}, [submitted, prefersReducedMotion]);

	const [clientRevealedLocation, setClientRevealedLocation] = useState<
		RevealedLocation | undefined
	>(revealedLocation);

	useEffect(() => {
		if (!enableResponseEditing || !submitted) return;

		if (attendanceStatus === 'declined') {
			setClientRevealedLocation(undefined);
			return;
		}

		if (attendanceStatus !== 'confirmed' || !locationInviteId) {
			return;
		}

		if (revealedLocation) {
			setClientRevealedLocation(revealedLocation);
			return;
		}

		if (locationFetchAttemptedRef.current) return;
		locationFetchAttemptedRef.current = true;

		let cancelled = false;
		void rsvpApi
			.getGatedLocation(locationInviteId)
			.then((payload) => {
				if (cancelled) return;
				setClientRevealedLocation(payload.location);
			})
			.catch(() => {
				locationFetchAttemptedRef.current = false;
			});

		return () => {
			cancelled = true;
		};
	}, [attendanceStatus, enableResponseEditing, locationInviteId, revealedLocation, submitted]);

	/* ----- cleanup ----- */
	useEffect(() => {
		return () => {
			if (recenterRef.current !== null) {
				cancelAnimationFrame(recenterRef.current);
			}
		};
	}, []);

	/* ----- render paths ----- */
	if (!isPersonalized && !isPublicRsvp) {
		return <LockedPreview title={title} variant={variant} />;
	}

	/* ----- track attendance transitions ----- */
	const handleAttendanceChange = useCallback(
		(status: 'confirmed' | 'declined') => {
			setAttendanceStatus(status);
			if (status === 'confirmed') {
				setAttendeeCount((current) => {
					const currentCount =
						typeof current === 'number' ? current : Number.parseInt(current, 10);
					return Number.isFinite(currentCount) && currentCount >= 1 ? current : 1;
				});
			}
			if (touched.attendance) validate();
			scheduleRsvpRecenter();
		},
		[setAttendeeCount, touched.attendance, validate, scheduleRsvpRecenter],
	);

	const handleChangeResponse = useCallback(() => {
		setIsEditingResponse(true);
		startEditingResponse();
	}, [startEditingResponse]);

	const handleCancelEdit = useCallback(() => {
		setIsEditingResponse(false);
		restoreInitialResponse();
	}, [restoreInitialResponse]);

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
						onFocusCapture={scheduleRsvpRecenter}
						name={name}
						attendanceStatus={attendanceStatus}
						confirmationMessage={confirmationMessage}
						celebrantName={celebrantName}
						responseMessages={responseMessages}
						revealedLocation={revealedLocation ?? clientRevealedLocation}
						enableResponseEditing={enableResponseEditing}
						onChangeResponse={handleChangeResponse}
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
						onFocusCapture={scheduleRsvpRecenter}
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
						showCancelEdit={isEditingResponse}
						onSubmit={handleSubmit}
						onCancelEdit={handleCancelEdit}
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
