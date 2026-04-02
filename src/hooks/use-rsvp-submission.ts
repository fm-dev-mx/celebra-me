import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type RefObject,
	type SyntheticEvent,
} from 'react';
import { rsvpApi } from '@/lib/client/rsvp-api';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import {
	normalizeGuestCount,
	normalizePhoneInput,
	type AttendanceStatus,
	validateRsvpForm,
} from '@/components/invitation/rsvp-logic';

interface InitialGuestData {
	fullName?: string;
	maxAllowedAttendees?: number;
	inviteId?: string;
}

interface UseRsvpSubmissionOptions {
	guestCap: number;
	eventType: EventRecord['eventType'];
	eventSlug: string;
	accessMode: 'personalized-only' | 'hybrid';
	initialGuestData?: InitialGuestData;
	prefersReducedMotion: boolean;
}

export function useRsvpSubmission({
	guestCap,
	eventType,
	eventSlug,
	accessMode,
	initialGuestData,
	prefersReducedMotion,
}: UseRsvpSubmissionOptions) {
	const [name, setName] = useState(initialGuestData?.fullName || '');
	const [phone, setPhone] = useState('');
	const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(null);
	const [attendeeCount, setAttendeeCount] = useState<number | string>(1);
	const [notes, setNotes] = useState('');
	const [nameLocked, setNameLocked] = useState(Boolean(initialGuestData?.fullName));
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
	const phoneRef = useRef<HTMLInputElement>(null);
	const attendanceRef = useRef<HTMLDivElement>(null);
	const guestCountRef = useRef<HTMLInputElement>(null);

	const effectiveGuestCap = Math.max(1, Number(contextGuestCap || guestCap));
	const supportsPlusOnes = effectiveGuestCap > 1;
	// Show phone field for public/hybrid access RSVPs
	const showPhoneField = !initialGuestData?.inviteId && accessMode === 'hybrid';
	// Make it optional even if shown (reduce friction)
	const phoneRequired = false;

	useEffect(() => {
		if (initialGuestData) {
			if (initialGuestData.fullName) {
				setName(initialGuestData.fullName);
				setNameLocked(true);
			}
			if (initialGuestData.maxAllowedAttendees) {
				setContextGuestCap(initialGuestData.maxAllowedAttendees);
			}
			if (initialGuestData.inviteId) {
				void rsvpApi.markViewed(initialGuestData.inviteId).catch(() => {});
			}
		} else {
			setNameLocked(false);
		}
	}, [initialGuestData]);

	const validate = useCallback(() => {
		const newErrors = validateRsvpForm({
			name,
			phone,
			phoneRequired,
			nameLocked,
			attendanceStatus,
			attendeeCount,
			supportsPlusOnes,
			effectiveGuestCap,
		});
		setErrors(newErrors);
		return newErrors;
	}, [
		attendanceStatus,
		attendeeCount,
		effectiveGuestCap,
		name,
		nameLocked,
		phone,
		phoneRequired,
		supportsPlusOnes,
	]);

	const handleBlur = useCallback(
		(field: string) => {
			setTouched((prev) => ({ ...prev, [field]: true }));
			validate();
		},
		[validate],
	);

	const handleSubmit = useCallback(
		async (event: SyntheticEvent) => {
			event.preventDefault();
			setSubmitStatus('loading');

			const validationErrors = validate();
			const errorKeys = Object.keys(validationErrors);

			if (errorKeys.length > 0) {
				setSubmitStatus('error');
				setTouched({
					name: true,
					phone: true,
					attendance: true,
					guestCount: true,
				});

				const firstError = errorKeys[0];
				const refMap: Record<string, RefObject<HTMLElement | null>> = {
					name: nameRef as RefObject<HTMLElement | null>,
					phone: phoneRef as RefObject<HTMLElement | null>,
					attendance: attendanceRef as RefObject<HTMLElement | null>,
					guestCount: guestCountRef as RefObject<HTMLElement | null>,
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
						targetRef.current.focus();
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
					if (accessMode !== 'hybrid') {
						setSubmitStatus('error');
						setErrors((prev) => ({
							...prev,
							global: 'Esta invitación requiere un enlace personalizado.',
						}));
						return;
					}

					await rsvpApi.submitPublicRsvp(eventType, eventSlug, {
						fullName: name.trim(),
						phone: normalizePhoneInput(phone),
						attendanceStatus: attendanceStatus as 'confirmed' | 'declined',
						attendeeCount: normalizedCount,
						guestComment: notes,
					});

					setSubmitStatus('success');
					window.setTimeout(() => setSubmitted(true), 500);
					return;
				}

				const payload = {
					attendanceStatus: attendanceStatus as 'confirmed' | 'declined',
					attendeeCount: normalizedCount,
					guestComment: notes,
				};

				const data = await rsvpApi.submitRsvp(initialGuestData.inviteId, payload);
				if (data.rsvpId) {
					setRsvpId(data.rsvpId);
				}

				setSubmitStatus('success');
				window.setTimeout(() => setSubmitted(true), 500);
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'No se pudo conectar con el servidor.';
				setSubmitStatus('error');
				setErrors((prev) => ({ ...prev, global: message }));
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			accessMode,
			attendanceStatus,
			attendeeCount,
			eventSlug,
			eventType,
			initialGuestData?.inviteId,
			notes,
			name,
			phone,
			prefersReducedMotion,
			supportsPlusOnes,
			validate,
		],
	);

	const handleWhatsAppClick = useCallback(async () => {
		if (!rsvpId) {
			return;
		}

		try {
			await rsvpApi.trackAction(rsvpId, 'clicked', 'whatsapp');
		} catch {
			// Telemetry failure should not block the user journey.
		}
	}, [rsvpId]);

	return {
		name,
		phone,
		showPhoneField,
		phoneRequired,
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
	};
}
