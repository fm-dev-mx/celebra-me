import React, { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { rsvpApi } from '@/lib/rsvp/rsvp-api';
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

interface RSVPProps {
	title: string;
	celebrantName?: string;
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
	initialGuestData,
}) => {
	const prefersReducedMotion = useReducedMotion();

	const [name, setName] = useState(initialGuestData?.fullName || '');
	const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(null);
	const [attendeeCount, setAttendeeCount] = useState<number | string>(1);
	const [notes, setNotes] = useState('');
	const [dietary, setDietary] = useState('');
	const [contextLoading, setContextLoading] = useState(!initialGuestData);
	const [nameLocked, setNameLocked] = useState(!!initialGuestData?.fullName);
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

	// WhatsApp CTA should appear only after submit + confirmed status + mode allows it + phone present
	const showWhatsAppCta =
		submitted &&
		attendanceStatus === 'confirmed' &&
		(confirmationMode === 'both' || confirmationMode === 'whatsapp') &&
		!!whatsappConfig?.phone;

	useEffect(() => {
		if (initialGuestData) {
			if (initialGuestData.fullName) {
				setName(initialGuestData.fullName);
				setNameLocked(true);
			}
			if (initialGuestData.maxAllowedAttendees) {
				setContextGuestCap(initialGuestData.maxAllowedAttendees);
			}
		} else {
			setNameLocked(false);
		}
		setContextLoading(false);
	}, [initialGuestData]);

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

	const handleSubmit = async (e: SyntheticEvent) => {
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

			const v2InviteId = initialGuestData?.inviteId;

			// We only support personalized RSVPs via InviteId now
			if (!v2InviteId) {
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

			const data = await rsvpApi.submitRsvp(v2InviteId, payload);
			if (data.rsvpId) setRsvpId(data.rsvpId);

			setSubmitStatus('success');
			setTimeout(() => setSubmitted(true), 500);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'No se pudo conectar con el servidor.';
			setSubmitStatus('error');
			setErrors((prev) => ({ ...prev, global: message }));
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleWhatsAppClick = async () => {
		if (!rsvpId) return;
		try {
			await rsvpApi.trackAction(rsvpId, 'clicked', 'whatsapp');
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
								¡Gracias, <strong className="rsvp__greeting-name">{name}</strong>!
								<br />
								{confirmationMessage}
							</>
						) : (
							<>
								Sentimos mucho que no puedas acompañarnos. <br />
								Gracias por avisarnos,{' '}
								<strong className="rsvp__greeting-name">{name}</strong>.
							</>
						)}
					</h2>

					<p className="rsvp__greeting-submessage">Tu confirmación ha sido registrada.</p>

					{showWhatsAppCta && (
						<div className="rsvp__contact-host">
							<p className="rsvp__contact-text">
								Comparte tu respuesta con{' '}
								<strong>{celebrantName || 'el festejado'}</strong>.
							</p>
							<a
								href={buildWhatsAppUrl()}
								target="_blank"
								rel="noopener noreferrer"
								className="rsvp__whatsapp-cta"
								onClick={handleWhatsAppClick}
								aria-label={`Enviar mensaje de WhatsApp a ${celebrantName || 'el festejado'}`}
							>
								<svg
									className="rsvp__whatsapp-icon"
									viewBox="0 0 24 24"
									fill="currentColor"
									width="20"
									height="20"
								>
									<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
								</svg>
								Enviar WhatsApp
							</a>
						</div>
					)}
				</div>
			</section>
		);
	}

	return (
		<section id="rsvp" className="rsvp" data-variant={variant}>
			<h2 className="rsvp__title">{title}</h2>

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
