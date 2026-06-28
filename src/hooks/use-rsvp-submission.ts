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
	parseRsvpPhoneInput,
	type AttendanceStatus,
	validateRsvpForm,
} from '@/components/invitation/rsvp-logic';
import { DEFAULT_COUNTRY_CODE } from '@/lib/phone/country-codes';
import { DEMO_GUEST_NAME } from '@/lib/invitation/section-render-data';
import { getSmartScrollBlock } from '@/lib/dom/viewport';

interface InitialGuestData {
	fullName?: string;
	maxAllowedAttendees?: number;
	inviteId?: string;
	attendanceStatus?: 'pending' | 'confirmed' | 'declined';
	attendeeCount?: number;
	guestComment?: string;
}

interface UseRsvpSubmissionOptions {
	guestCap: number;
	eventType: EventRecord['eventType'];
	eventSlug: string;
	accessMode: 'personalized-only' | 'hybrid';
	initialGuestData?: InitialGuestData;
	prefersReducedMotion: boolean;
	isDemoPreview?: boolean;
}

function notifyConfirmedRsvp(inviteId: string): void {
	if (typeof window === 'undefined' || !inviteId) return;

	window.dispatchEvent(
		new CustomEvent('celebrame:rsvp-confirmed', {
			detail: { inviteId },
		}),
	);
}

export function useRsvpSubmission({
	guestCap,
	eventType,
	eventSlug,
	accessMode,
	initialGuestData: initialData,
	prefersReducedMotion,
	isDemoPreview,
}: UseRsvpSubmissionOptions) {
	const initialName = isDemoPreview ? DEMO_GUEST_NAME : initialData?.fullName || '';
	const initialAttendanceStatus: AttendanceStatus =
		initialData?.attendanceStatus === 'confirmed' ||
		initialData?.attendanceStatus === 'declined'
			? initialData.attendanceStatus
			: null;

	const [name, setName] = useState(initialName);
	const [phone, setPhone] = useState('');
	const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
	const [attendanceStatus, setAttendanceStatus] =
		useState<AttendanceStatus>(initialAttendanceStatus);
	const effectiveGuestCap = Math.max(
		1,
		isDemoPreview ? guestCap : (initialData?.maxAllowedAttendees ?? guestCap),
	);
	const initialAttendeeCount =
		initialAttendanceStatus === 'declined'
			? 0
			: (initialData?.attendeeCount ?? 0) || effectiveGuestCap;
	const initialGuestComment = initialData?.guestComment ?? '';
	const [attendeeCount, setAttendeeCount] = useState<number | string>(initialAttendeeCount);
	const [notes, setNotes] = useState(initialGuestComment);
	const savedResponseRef = useRef<{
		attendanceStatus: AttendanceStatus;
		attendeeCount: number;
		guestComment: string;
	}>({
		attendanceStatus: initialAttendanceStatus,
		attendeeCount: initialAttendeeCount,
		guestComment: initialGuestComment,
	});
	const nameLocked = isDemoPreview || Boolean(initialData?.fullName);
	const rsvpTrackingRef = useRef('');
	const [responseInviteId, setResponseInviteId] = useState(initialData?.inviteId ?? '');
	const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
		initialAttendanceStatus ? 'success' : 'idle',
	);
	const isSubmitting = submitStatus === 'loading';
	const submitted = submitStatus === 'success';
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	// Track initial data viewed status - only once per mount
	const hasMarkedViewed = useRef(false);
	useEffect(() => {
		if (initialData?.inviteId && !hasMarkedViewed.current && !isDemoPreview) {
			hasMarkedViewed.current = true;
			void rsvpApi.markViewed(initialData.inviteId).catch(() => {});
		}
	}, [initialData?.inviteId, isDemoPreview]);

	const nameRef = useRef<HTMLInputElement>(null);
	const phoneRef = useRef<HTMLInputElement>(null);
	const attendanceRef = useRef<HTMLDivElement>(null);
	const guestCountRef = useRef<HTMLInputElement>(null);
	const isInFlightRef = useRef(false);

	const supportsPlusOnes = effectiveGuestCap > 1;
	const isPersonalized = isDemoPreview || Boolean(initialData?.inviteId);
	const isPublicRsvp = !isPersonalized && accessMode === 'hybrid';
	const showPhoneField = isPublicRsvp;
	const handlePhoneChange = useCallback((value: string) => {
		const parsed = parseRsvpPhoneInput(value);
		setPhone(parsed.phone);

		if (value.trim().startsWith('+')) {
			setCountryCode(parsed.countryCode);
		}
	}, []);

	const startEditingResponse = useCallback(() => {
		setSubmitStatus('idle');
		setErrors({});
		setTouched({});
	}, []);

	const restoreInitialResponse = useCallback(() => {
		const saved = savedResponseRef.current;
		setAttendanceStatus(saved.attendanceStatus);
		setAttendeeCount(saved.attendeeCount);
		setNotes(saved.guestComment);
		setErrors({});
		setTouched({});
		setSubmitStatus(saved.attendanceStatus ? 'success' : 'idle');
	}, []);

	const validate = useCallback(() => {
		const newErrors = validateRsvpForm({
			name,
			phone,
			phoneRequired: false,
			nameLocked,
			attendanceStatus,
			attendeeCount,
			supportsPlusOnes,
			effectiveGuestCap,
			isPublicRsvp,
		});
		setErrors(newErrors);
		return newErrors;
	}, [
		attendanceStatus,
		attendeeCount,
		effectiveGuestCap,
		isPublicRsvp,
		name,
		nameLocked,
		phone,
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

			if (isInFlightRef.current) return;
			isInFlightRef.current = true;
			setSubmitStatus('loading');

			try {
				if (isDemoPreview) {
					await new Promise((resolve) => setTimeout(resolve, 800));
					setSubmitStatus('success');
					return;
				}

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
							block: getSmartScrollBlock(targetRef.current),
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

				const normalizedCount = normalizeGuestCount(
					attendanceStatus,
					attendeeCount,
					supportsPlusOnes,
				);

				if (!initialData?.inviteId) {
					if (accessMode !== 'hybrid') {
						setSubmitStatus('error');
						setErrors((prev) => ({
							...prev,
							global: 'Esta invitación requiere un enlace personalizado.',
						}));
						return;
					}

					const trimmedNotes = notes.trim();
					const normalizedPhone = normalizePhoneInput(phone);

					const publicResult = await rsvpApi.submitPublicRsvp(eventType, eventSlug, {
						fullName: name.trim(),
						attendanceStatus: attendanceStatus as 'confirmed' | 'declined',
						attendeeCount: normalizedCount,
						guestComment: trimmedNotes,
						...(normalizedPhone ? { phone: normalizedPhone, countryCode } : {}),
					} as import('@/lib/client/rsvp-api').PublicRsvpPayload);

					const publicInviteId = publicResult.inviteId;
					rsvpTrackingRef.current = publicInviteId ?? '';
					setResponseInviteId(publicInviteId ?? responseInviteId);
					savedResponseRef.current = {
						attendanceStatus,
						attendeeCount: normalizedCount,
						guestComment: trimmedNotes,
					};
					setSubmitStatus('success');
					if (attendanceStatus === 'confirmed' && publicInviteId) {
						notifyConfirmedRsvp(publicInviteId);
					}
					return;
				}

				const data = await rsvpApi.submitRsvp(initialData.inviteId, {
					attendanceStatus: attendanceStatus as 'confirmed' | 'declined',
					attendeeCount: normalizedCount,
					guestComment: notes.trim(),
				});
				rsvpTrackingRef.current = data.rsvpId ?? '';
				setResponseInviteId(initialData.inviteId);
				savedResponseRef.current = {
					attendanceStatus,
					attendeeCount: normalizedCount,
					guestComment: notes.trim(),
				};
				setSubmitStatus('success');
				if (attendanceStatus === 'confirmed') {
					notifyConfirmedRsvp(initialData.inviteId);
				}
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'No se pudo conectar con el servidor.';
				setSubmitStatus('error');
				setErrors((prev) => ({ ...prev, global: message }));
			} finally {
				isInFlightRef.current = false;
				setSubmitStatus((prev) => (prev === 'loading' ? 'error' : prev));
			}
		},
		[
			accessMode,
			attendanceStatus,
			attendeeCount,
			countryCode,
			eventSlug,
			eventType,
			initialData?.inviteId,
			isDemoPreview,
			notes,
			name,
			phone,
			prefersReducedMotion,
			supportsPlusOnes,
			validate,
		],
	);

	const handleWhatsAppClick = useCallback(async () => {
		const trackingId = rsvpTrackingRef.current;
		if (!trackingId) return;

		try {
			await rsvpApi.trackAction(trackingId, 'clicked', 'whatsapp');
		} catch {
			// Telemetry failure should not block the user journey.
		}
	}, []);

	return {
		name,
		phone,
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
		countryCode,
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
	};
}
