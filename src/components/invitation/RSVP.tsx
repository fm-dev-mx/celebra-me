import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import '@/styles/invitation/_rsvp.scss';

type ConfirmationMode = 'api' | 'whatsapp' | 'both';
type AttendanceStatus = 'confirmed' | 'declined' | null;

interface WhatsAppConfig {
	phone: string;

	/**
	 * Backward-compatible single template.
	 * Supported placeholders: {name}, {guestCount}, {title}
	 */
	messageTemplate?: string;

	/**
	 * Preferred: split templates by status.
	 * Supported placeholders: {name}, {guestCount}, {title}
	 */
	confirmedTemplate?: string;
	declinedTemplate?: string;

	/**
	 * If true, default templates omit {title}.
	 */
	omitTitle?: boolean;
}

interface ContextResponse {
	eventSlug: string;
	mode: 'personalized' | 'generic';
	tokenValid: boolean;
	invalidTokenMessage?: string;
	guest?: {
		guestId: string;
		displayName: string;
		maxAllowedAttendees: number;
	};
	currentResponse?: {
		rsvpId: string;
		attendanceStatus: 'pending' | 'confirmed' | 'declined';
		attendeeCount: number;
		updatedAt: string;
	};
}

interface RSVPProps {
	eventSlug?: string;
	title: string;
	guestCap: number;
	confirmationMessage: string;
	nameLabel?: string;
	attendanceLabel?: string;
	guestCountLabel?: string;
	buttonLabel?: string;
	showDietaryField?: boolean;
	dietaryLabel?: string;
	dietaryPlaceholder?: string;
	variant?: string;
	confirmationMode?: ConfirmationMode;
	whatsappConfig?: WhatsAppConfig;
	apiEndpoint?: string;
}

const RSVP: React.FC<RSVPProps> = ({
	eventSlug,
	title,
	guestCap,
	confirmationMessage,
	nameLabel = 'Nombre completo *',
	attendanceLabel = '¿Asistirás al evento? *',
	guestCountLabel = 'Número total de asistentes',
	buttonLabel = 'Confirmar',
	showDietaryField = false,
	dietaryLabel = 'Alergias o restricciones alimentarias',
	dietaryPlaceholder = 'Ej. Vegetariano, alergia al maní...',
	variant,
	confirmationMode = 'api',
	whatsappConfig,
	apiEndpoint = '/api/rsvp',
}) => {
	const prefersReducedMotion = useReducedMotion();

	const [name, setName] = useState('');
	const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(null);
	const [attendeeCount, setAttendeeCount] = useState<number | string>(1);
	const [notes, setNotes] = useState('');
	const [dietary, setDietary] = useState('');
	const [token, setToken] = useState('');
	const [contextLoading, setContextLoading] = useState(true);
	const [contextMode, setContextMode] = useState<'personalized' | 'generic'>('generic');
	const [tokenWarning, setTokenWarning] = useState('');
	const [nameLocked, setNameLocked] = useState(false);
	const [contextGuestCap, setContextGuestCap] = useState<number>(Number(guestCap));
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

	// WhatsApp CTA should appear only after submit + confirmed status + mode allows it + phone present
	const showWhatsAppCta =
		submitted &&
		attendanceStatus === 'confirmed' &&
		(confirmationMode === 'both' || confirmationMode === 'whatsapp') &&
		!!whatsappConfig?.phone;

	// Load context if eventSlug exists (personalized links)
	useEffect(() => {
		if (!eventSlug) {
			setContextLoading(false);
			return;
		}

		const params = new URLSearchParams(window.location.search);
		const prefilledName = params.get('g') || params.get('name');
		if (prefilledName) setName(prefilledName);

		const tokenParam = params.get('t') || '';
		setToken(tokenParam);

		let isActive = true;

		const loadContext = async () => {
			setContextLoading(true);
			try {
				const query = new URLSearchParams({ eventSlug });
				if (tokenParam) query.set('token', tokenParam);

				const response = await fetch(`/api/rsvp/context?${query.toString()}`);
				if (!response.ok) {
					if (isActive) setContextMode('generic');
					return;
				}

				const context = (await response.json()) as ContextResponse;

				if (context.mode === 'personalized' && context.tokenValid && context.guest) {
					if (isActive) {
						setContextMode('personalized');
						setName(context.guest.displayName);
						setNameLocked(true);
						setContextGuestCap(context.guest.maxAllowedAttendees);
					}

					if (context.currentResponse) {
						if (isActive) setRsvpId(context.currentResponse.rsvpId);

						if (context.currentResponse.attendanceStatus === 'confirmed') {
							if (isActive) {
								setAttendanceStatus('confirmed');
								setAttendeeCount(
									Math.max(1, context.currentResponse.attendeeCount),
								);
							}
						} else if (context.currentResponse.attendanceStatus === 'declined') {
							if (isActive) {
								setAttendanceStatus('declined');
								setAttendeeCount(0);
							}
						}
					}
				} else {
					if (isActive) {
						setContextMode('generic');
						setNameLocked(false);
					}
					if (context.invalidTokenMessage && isActive) {
						setTokenWarning(context.invalidTokenMessage);
					}
				}
			} catch {
				if (isActive) setContextMode('generic');
			} finally {
				if (isActive) setContextLoading(false);
			}
		};

		void loadContext();

		return () => {
			isActive = false;
		};
	}, [eventSlug]);

	// Telemetry: CTA rendered
	useEffect(() => {
		const logCtaRendered = async () => {
			if (!showWhatsAppCta || !rsvpId) return;
			try {
				await fetch('/api/rsvp/channel', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						rsvpId,
						channel: 'whatsapp',
						action: 'cta_rendered',
					}),
				});
			} catch {
				// non-blocking telemetry
			}
		};

		void logCtaRendered();
	}, [showWhatsAppCta, rsvpId]);

	const buildWhatsAppUrl = (): string => {
		if (!whatsappConfig?.phone) return '';

		const isConfirmed = attendanceStatus === 'confirmed';

		// Prefer split templates; fallback to legacy messageTemplate; then fallback to defaults.
		const omitTitleByDefault = Boolean(whatsappConfig.omitTitle);

		const defaultConfirmedTemplate = omitTitleByDefault
			? 'Hola, soy {name}. Confirmo mi asistencia. Asistiremos {guestCount} persona(s).'
			: 'Hola, soy {name}. Confirmo mi asistencia a {title}. Asistiremos {guestCount} persona(s).';

		const defaultDeclinedTemplate = omitTitleByDefault
			? 'Hola, soy {name}. Lamentablemente no podré asistir.'
			: 'Hola, soy {name}. Lamentablemente no podré asistir a {title}.';

		const template =
			(isConfirmed ? whatsappConfig.confirmedTemplate : whatsappConfig.declinedTemplate) ??
			whatsappConfig.messageTemplate ??
			(isConfirmed ? defaultConfirmedTemplate : defaultDeclinedTemplate);

		// Normalize guestCount: confirmed => min 1; declined => 0
		const normalizedGuestCount = isConfirmed
			? Math.max(
					1,
					typeof attendeeCount === 'string'
						? parseInt(attendeeCount, 10) || 1
						: attendeeCount,
				)
			: 0;

		const message = template
			.replaceAll('{name}', name)
			.replaceAll('{guestCount}', String(normalizedGuestCount))
			.replaceAll('{title}', title);

		return `https://wa.me/${whatsappConfig.phone}?text=${encodeURIComponent(message)}`;
	};

	const validate = () => {
		const newErrors: Record<string, string> = {};

		if (!nameLocked && !name.trim()) {
			newErrors.name = 'Por favor, escribe tu nombre completo.';
		}

		if (!attendanceStatus) {
			newErrors.attendance = 'Por favor, selecciona si asistirás.';
		}

		if (attendanceStatus === 'confirmed') {
			const parsedCount =
				typeof attendeeCount === 'string' ? parseInt(attendeeCount, 10) : attendeeCount;
			const normalizedCount = supportsPlusOnes ? parsedCount : 1;

			if (!normalizedCount || normalizedCount < 1) {
				newErrors.guestCount = 'El número de invitados debe ser al menos 1.';
			} else if (normalizedCount > effectiveGuestCap) {
				newErrors.guestCount = `El límite de invitados es de ${effectiveGuestCap}.`;
			}
		}

		setErrors(newErrors);
		return newErrors;
	};

	const handleBlur = (field: string) => {
		setTouched((prev) => ({ ...prev, [field]: true }));
		validate();
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
			const parsedCount =
				typeof attendeeCount === 'string' ? parseInt(attendeeCount, 10) : attendeeCount;
			const normalizedCount =
				attendanceStatus === 'confirmed' ? (supportsPlusOnes ? parsedCount || 1 : 1) : 0;

			const payload: Record<string, unknown> = {
				eventSlug,
				token: token || undefined,
				guestName: name,
				attendanceStatus,
				attendeeCount: normalizedCount,
				notes,
			};

			if (showDietaryField && dietary.trim()) {
				payload.dietary = dietary.trim();
			}

			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (response.ok) {
				const data = (await response.json()) as { rsvpId?: string };
				if (data.rsvpId) setRsvpId(data.rsvpId);

				setSubmitStatus('success');
				setTimeout(() => setSubmitted(true), 500);
			} else {
				let message = 'Error al enviar.';
				try {
					const data = (await response.json()) as { message?: string };
					if (data?.message) message = data.message;
				} catch {
					// ignore json parse failure
				}
				setSubmitStatus('error');
				setErrors((prev) => ({ ...prev, global: message }));
			}
		} catch {
			setSubmitStatus('error');
			setErrors((prev) => ({ ...prev, global: 'No se pudo conectar con el servidor.' }));
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleWhatsAppClick = async () => {
		if (!rsvpId) return;
		try {
			await fetch('/api/rsvp/channel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					rsvpId,
					channel: 'whatsapp',
					action: 'clicked',
				}),
			});
		} catch {
			// non-blocking telemetry
		}
	};

	if (contextLoading) {
		return (
			<section id="rsvp" className="rsvp" data-variant={variant}>
				<h2 className="rsvp__title">{title}</h2>
				<p>Cargando confirmación...</p>
			</section>
		);
	}

	if (submitted) {
		return (
			<section id="rsvp" className="rsvp" data-variant={variant}>
				<div className="rsvp__greeting">
					<span
						className="rsvp__greeting-icon"
						data-response={attendanceStatus === 'confirmed' ? 'yes' : 'no'}
						role="img"
						aria-label={
							attendanceStatus === 'confirmed' ? 'Celebración' : 'Agradecimiento'
						}
					/>
					<h2 className="rsvp__greeting-message">
						{attendanceStatus === 'confirmed' ? (
							<>
								¡Gracias, <strong>{name}</strong>!<br />
								{confirmationMessage}
							</>
						) : (
							<>
								Sentimos mucho que no puedas acompañarnos. <br />
								Gracias por avisarnos, <strong>{name}</strong>.
							</>
						)}
					</h2>

					<p className="rsvp__greeting-submessage">Tu respuesta ha sido registrada.</p>

					{showWhatsAppCta && (
						<a
							href={buildWhatsAppUrl()}
							target="_blank"
							rel="noopener noreferrer"
							className="rsvp__whatsapp-cta"
							onClick={handleWhatsAppClick}
							aria-label="Enviar confirmación por WhatsApp"
						>
							Enviar confirmación por WhatsApp
						</a>
					)}
				</div>
			</section>
		);
	}

	return (
		<section id="rsvp" className="rsvp" data-variant={variant}>
			<h2 className="rsvp__title">{title}</h2>

			{contextMode === 'personalized' && (
				<p className="rsvp__greeting-submessage">
					Hola, <strong>{name}</strong>. Tu enlace está personalizado.
				</p>
			)}

			{tokenWarning && <p className="rsvp__error">{tokenWarning}</p>}

			<form onSubmit={handleSubmit} className="rsvp__form" id="rsvp-form">
				{!nameLocked && (
					<motion.div
						className={`rsvp__field ${touched.name && errors.name ? 'rsvp__field--error' : ''}`}
						initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
						whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
						viewport={prefersReducedMotion ? undefined : { once: true }}
					>
						<label htmlFor="name">{nameLabel}</label>
						<input
							ref={nameRef}
							type="text"
							id="name"
							placeholder="Escribe tu nombre"
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								if (touched.name) validate();
							}}
							onBlur={() => handleBlur('name')}
							aria-invalid={!!(touched.name && errors.name)}
							aria-describedby={
								touched.name && errors.name ? 'name-error' : undefined
							}
						/>
						{touched.name && errors.name && (
							<p className="rsvp__field-error" id="name-error" role="alert">
								{errors.name}
							</p>
						)}
					</motion.div>
				)}

				<motion.fieldset
					className={`rsvp__field rsvp__fieldset ${
						touched.attendance && errors.attendance ? 'rsvp__field--error' : ''
					}`}
					initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
					whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
					viewport={prefersReducedMotion ? undefined : { once: true }}
					transition={prefersReducedMotion ? undefined : { delay: 0.1 }}
				>
					<legend className="rsvp__legend">{attendanceLabel}</legend>

					<div className="rsvp__radio-group" ref={attendanceRef}>
						<label>
							<input
								type="radio"
								name="attendance"
								checked={attendanceStatus === 'confirmed'}
								onChange={() => {
									setAttendanceStatus('confirmed');
									if (!supportsPlusOnes) setAttendeeCount(1);
									if (touched.attendance) validate();
								}}
								onBlur={() => handleBlur('attendance')}
							/>
							Sí, asistiré
						</label>

						<label>
							<input
								type="radio"
								name="attendance"
								checked={attendanceStatus === 'declined'}
								onChange={() => {
									setAttendanceStatus('declined');
									setAttendeeCount(0);
									if (touched.attendance) validate();
								}}
								onBlur={() => handleBlur('attendance')}
							/>
							No podré asistir
						</label>
					</div>

					{touched.attendance && errors.attendance && (
						<p className="rsvp__field-error" role="alert">
							{errors.attendance}
						</p>
					)}
				</motion.fieldset>

				<AnimatePresence>
					{attendanceStatus === 'confirmed' && (
						<motion.div
							initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: 'auto' }}
							exit={
								prefersReducedMotion
									? { opacity: 1, height: 'auto' }
									: { opacity: 0, height: 0 }
							}
							transition={prefersReducedMotion ? { duration: 0 } : undefined}
							className="rsvp__extra-fields"
						>
							{supportsPlusOnes && (
								<div
									className={`rsvp__field ${
										touched.guestCount && errors.guestCount
											? 'rsvp__field--error'
											: ''
									}`}
								>
									<label htmlFor="guestCount">
										{guestCountLabel}
										{effectiveGuestCap <= 10
											? ` (Máx. ${effectiveGuestCap})`
											: ''}
									</label>

									<input
										ref={guestCountRef}
										type="number"
										id="guestCount"
										min="1"
										max={effectiveGuestCap}
										value={attendeeCount}
										onChange={(e) => {
											setAttendeeCount(e.target.value);
											if (touched.guestCount) validate();
										}}
										onBlur={() => handleBlur('guestCount')}
									/>

									{touched.guestCount && errors.guestCount && (
										<p className="rsvp__field-error" role="alert">
											{errors.guestCount}
										</p>
									)}
								</div>
							)}

							{showDietaryField && (
								<div className="rsvp__field">
									<label htmlFor="dietary">{dietaryLabel}</label>
									<textarea
										id="dietary"
										placeholder={dietaryPlaceholder}
										rows={2}
										value={dietary}
										onChange={(e) => setDietary(e.target.value)}
									/>
								</div>
							)}

							<div className="rsvp__field">
								<label htmlFor="notes">Notas adicionales</label>
								<textarea
									id="notes"
									placeholder="Alguna nota para nosotros..."
									rows={2}
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
								/>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				<div aria-live="polite" aria-atomic="true" className="rsvp__error-region">
					{errors.global && (
						<p className="rsvp__error" role="alert">
							{errors.global}
						</p>
					)}
				</div>

				<motion.button
					type="submit"
					disabled={isSubmitting}
					className={`rsvp__button rsvp__button--${submitStatus}`}
					initial={prefersReducedMotion ? false : { opacity: 0 }}
					whileInView={prefersReducedMotion ? undefined : { opacity: 1 }}
					viewport={prefersReducedMotion ? undefined : { once: true }}
					transition={prefersReducedMotion ? undefined : { delay: 0.2 }}
				>
					<span className="rsvp__button-text">
						{submitStatus === 'loading'
							? 'Enviando...'
							: submitStatus === 'success'
								? '¡Confirmado!'
								: submitStatus === 'error'
									? 'Confirmar asistencia'
									: buttonLabel}
					</span>
				</motion.button>
			</form>
		</section>
	);
};

export default RSVP;
