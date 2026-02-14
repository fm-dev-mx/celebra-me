import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import '@/styles/invitation/_rsvp.scss';

type ConfirmationMode = 'api' | 'whatsapp' | 'both';

interface WhatsAppConfig {
	phone: string;
	messageTemplate?: string;
}

interface RSVPProps {
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
	title,
	guestCap,
	confirmationMessage,
	nameLabel = 'Tu nombre completo *',
	attendanceLabel = '¿Asistirás al evento? *',
	guestCountLabel = 'Número de acompañantes',
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
	const [attendance, setAttendance] = useState<'yes' | 'no' | null>(null);
	const [guestCount, setGuestCount] = useState<number | string>(1);
	const [notes, setNotes] = useState('');
	const [dietary, setDietary] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
		'idle',
	);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	// Refs for focus/scroll
	const nameRef = useRef<HTMLInputElement>(null);
	const attendanceRef = useRef<HTMLDivElement>(null);
	const guestCountRef = useRef<HTMLInputElement>(null);

	// URL Pre-fill logic
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const prefilledName = params.get('g') || params.get('name');
		if (prefilledName) {
			setName(prefilledName);
		}
	}, []);

	const buildWhatsAppUrl = () => {
		if (!whatsappConfig?.phone) return '';
		const template =
			whatsappConfig.messageTemplate ||
			'Hola, soy {name}. Confirmo mi asistencia ({attendance}). Acompañantes: {guestCount}.';
		const message = template
			.replace('{name}', name)
			.replace('{attendance}', attendance === 'yes' ? 'Sí, asistiré' : 'No podré asistir')
			.replace('{guestCount}', String(guestCount));
		return `https://wa.me/${whatsappConfig.phone}?text=${encodeURIComponent(message)}`;
	};

	const validate = () => {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Por favor, escribe tu nombre completo.';
		}

		if (!attendance) {
			newErrors.attendance = 'Por favor, selecciona si asistirás.';
		}

		if (attendance === 'yes') {
			const count = typeof guestCount === 'string' ? parseInt(guestCount) : guestCount;
			if (!count || count < 1) {
				newErrors.guestCount = 'El número de invitados debe ser al menos 1.';
			} else if (count > Number(guestCap)) {
				newErrors.guestCount = `El límite de invitados es de ${guestCap}.`;
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

			// Scroll to first error
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

				// Auto-focus the first field with error
				if (firstError === 'attendance') {
					const firstRadio = targetRef.current.querySelector(
						'input[type="radio"]',
					) as HTMLInputElement;
					firstRadio?.focus();
				} else {
					(targetRef.current as HTMLElement).focus();
				}
			}

			return;
		}

		// WhatsApp-only mode: open link and mark as submitted
		if (confirmationMode === 'whatsapp') {
			const url = buildWhatsAppUrl();
			if (url) window.open(url, '_blank', 'noopener,noreferrer');
			setSubmitStatus('success');
			setTimeout(() => setSubmitted(true), 600);
			return;
		}

		setIsSubmitting(true);

		try {
			const payload: Record<string, unknown> = {
				name,
				attendance,
				guestCount: attendance === 'yes' ? Number(guestCount) || 1 : 0,
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
				setSubmitStatus('success');
				setTimeout(() => setSubmitted(true), 800);
			} else {
				const data = await response.json();
				setSubmitStatus('error');
				setErrors((prev) => ({ ...prev, global: data.message || 'Error al enviar.' }));
			}
		} catch {
			setSubmitStatus('error');
			setErrors((prev) => ({ ...prev, global: 'No se pudo conectar con el servidor.' }));
		} finally {
			setIsSubmitting(false);
		}
	};

	if (submitted) {
		const showWhatsAppCta =
			(confirmationMode === 'both' || confirmationMode === 'whatsapp') &&
			whatsappConfig?.phone &&
			attendance === 'yes';
		return (
			<section id="rsvp" className="rsvp" data-variant={variant}>
				<div className="rsvp__greeting">
					<span
						className="rsvp__greeting-icon"
						data-response={attendance === 'yes' ? 'yes' : 'no'}
						role="img"
						aria-label={attendance === 'yes' ? 'Celebración' : 'Agradecimiento'}
					/>
					<h2 className="rsvp__greeting-message">
						{attendance === 'yes' ? (
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

			<form onSubmit={handleSubmit} className="rsvp__form" id="rsvp-form">
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
						aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
					/>
					{touched.name && errors.name && (
						<p className="rsvp__field-error" id="name-error" role="alert">
							{errors.name}
						</p>
					)}
				</motion.div>

				<motion.fieldset
					className={`rsvp__field rsvp__fieldset ${touched.attendance && errors.attendance ? 'rsvp__field--error' : ''}`}
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
								checked={attendance === 'yes'}
								onChange={() => {
									setAttendance('yes');
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
								checked={attendance === 'no'}
								onChange={() => {
									setAttendance('no');
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
					{attendance === 'yes' && (
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
							<div
								className={`rsvp__field ${touched.guestCount && errors.guestCount ? 'rsvp__field--error' : ''}`}
							>
								<label htmlFor="guestCount">
									{guestCountLabel}
									{Number(guestCap) <= 4 ? ` (Máx. ${guestCap})` : ''}
								</label>
								<input
									ref={guestCountRef}
									type="number"
									id="guestCount"
									min="1"
									max={guestCap}
									value={guestCount}
									onChange={(e) => {
										setGuestCount(e.target.value);
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
									? 'Confirmar Asistencia'
									: buttonLabel}
					</span>
				</motion.button>
			</form>
		</section>
	);
};

export default RSVP;
