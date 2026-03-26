import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type RefObject,
	type SyntheticEvent,
} from 'react';
import { rsvpApi } from '@/lib/client/rsvp-api';
import {
	normalizeGuestCount,
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
	initialGuestData?: InitialGuestData;
	prefersReducedMotion: boolean;
}

export function useRsvpSubmission({
	guestCap,
	initialGuestData,
	prefersReducedMotion,
}: UseRsvpSubmissionOptions) {
	const [name, setName] = useState(initialGuestData?.fullName || '');
	const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(null);
	const [attendeeCount, setAttendeeCount] = useState<number | string>(1);
	const [notes, setNotes] = useState('');
	const [dietary, setDietary] = useState('');
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
	const attendanceRef = useRef<HTMLDivElement>(null);
	const guestCountRef = useRef<HTMLInputElement>(null);

	const effectiveGuestCap = Math.max(1, Number(contextGuestCap || guestCap));
	const supportsPlusOnes = effectiveGuestCap > 1;

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
			nameLocked,
			attendanceStatus,
			attendeeCount,
			supportsPlusOnes,
			effectiveGuestCap,
		});
		setErrors(newErrors);
		return newErrors;
	}, [attendanceStatus, attendeeCount, effectiveGuestCap, name, nameLocked, supportsPlusOnes]);

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
					attendance: true,
					guestCount: true,
				});

				const firstError = errorKeys[0];
				const refMap: Record<string, RefObject<HTMLElement | null>> = {
					name: nameRef as RefObject<HTMLElement | null>,
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
					setSubmitStatus('error');
					setErrors((prev) => ({
						...prev,
						global: 'Esta invitación requiere un enlace personalizado.',
					}));
					return;
				}

				const payload = {
					attendanceStatus: attendanceStatus as 'confirmed' | 'declined',
					attendeeCount: normalizedCount,
					guestMessage: notes,
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
			attendanceStatus,
			attendeeCount,
			initialGuestData?.inviteId,
			notes,
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
	};
}
