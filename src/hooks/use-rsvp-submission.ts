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
	isDemoPreview?: boolean;
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

	const [name, setName] = useState(initialName);
	const [phone, setPhone] = useState('');
	const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
	const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(null);
	const contextGuestCap = Number(
		isDemoPreview ? guestCap : initialData?.maxAllowedAttendees || guestCap,
	);
	const effectiveGuestCap = Math.max(1, Number(contextGuestCap || guestCap));
	const [attendeeCount, setAttendeeCount] = useState<number | string>(1);
	const [notes, setNotes] = useState('');
	const nameLocked = isDemoPreview || Boolean(initialData?.fullName);
	const [rsvpId, setRsvpId] = useState('');
	const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
		'idle',
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

	const supportsPlusOnes = effectiveGuestCap > 1;
	const isPersonalized = isDemoPreview || Boolean(initialData?.inviteId);
	const isPublicRsvp = !isPersonalized && accessMode === 'hybrid';
	const showPhoneField = isPublicRsvp;
	const handlePhoneChange = useCallback((value: string) => {
		const parsed = parseRsvpPhoneInput(value);
		setCountryCode(parsed.countryCode);
		setPhone(parsed.phone);
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

			setSubmitStatus('loading');

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

			try {
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

					if (publicResult.inviteId) {
						setRsvpId(publicResult.inviteId);
					}

					setSubmitStatus('success');
					return;
				}

				const payload = {
					attendanceStatus: attendanceStatus as 'confirmed' | 'declined',
					attendeeCount: normalizedCount,
					guestComment: notes.trim(),
				};

				const data = await rsvpApi.submitRsvp(initialData.inviteId, payload);
				if (data.rsvpId) {
					setRsvpId(data.rsvpId);
				}

				setSubmitStatus('success');
			} catch (err) {
				const message =
					err instanceof Error ? err.message : 'No se pudo conectar con el servidor.';
				setSubmitStatus('error');
				setErrors((prev) => ({ ...prev, global: message }));
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
		validate,
	};
}
