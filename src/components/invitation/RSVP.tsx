import React, { useState, useEffect } from 'react';
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
	const [guestCount, setGuestCount] = useState<number>(1);
	const [notes, setNotes] = useState('');
	const [dietary, setDietary] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string | null>(null);

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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!name || !attendance) {
			setError('Por favor, completa los campos obligatorios.');
			return;
		}

		if (attendance === 'yes' && guestCount > Number(guestCap)) {
			setError(`El límite de invitados es de ${guestCap}.`);
			return;
		}

		// WhatsApp-only mode: open link and mark as submitted
		if (confirmationMode === 'whatsapp') {
			const url = buildWhatsAppUrl();
			if (url) window.open(url, '_blank', 'noopener,noreferrer');
			setSubmitted(true);
			return;
		}

		setIsSubmitting(true);

		try {
			const payload: Record<string, unknown> = {
				name,
				attendance,
				guestCount: attendance === 'yes' ? guestCount : 0,
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
				setSubmitted(true);
			} else {
				const data = await response.json();
				setError(data.message || 'Ocurrió un error al enviar tu confirmación.');
			}
		} catch {
			setError('No se pudo conectar con el servidor.');
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
					className="rsvp__field"
					initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
					whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
					viewport={prefersReducedMotion ? undefined : { once: true }}
				>
					<label htmlFor="name">{nameLabel}</label>
					<input
						type="text"
						id="name"
						placeholder="Escribe tu nombre"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
					/>
				</motion.div>

				<motion.fieldset
					className="rsvp__field rsvp__fieldset"
					initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
					whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
					viewport={prefersReducedMotion ? undefined : { once: true }}
					transition={prefersReducedMotion ? undefined : { delay: 0.1 }}
				>
					<legend className="rsvp__legend">{attendanceLabel}</legend>
					<div className="rsvp__radio-group">
						<label>
							<input
								type="radio"
								name="attendance"
								checked={attendance === 'yes'}
								onChange={() => setAttendance('yes')}
								required
							/>
							Sí, asistiré
						</label>
						<label>
							<input
								type="radio"
								name="attendance"
								checked={attendance === 'no'}
								onChange={() => setAttendance('no')}
								required
							/>
							No podré asistir
						</label>
					</div>
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
							<div className="rsvp__field">
								<label htmlFor="guestCount">
									{guestCountLabel}
									{Number(guestCap) <= 4 ? ` (Máx. ${guestCap})` : ''}
								</label>
								<input
									type="number"
									id="guestCount"
									min="1"
									max={guestCap}
									value={guestCount}
									onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
									required
								/>
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
					{error && (
						<p className="rsvp__error" role="alert">
							{error}
						</p>
					)}
				</div>

				<motion.button
					type="submit"
					disabled={isSubmitting || !attendance}
					className={`rsvp__button ${isSubmitting ? 'rsvp__button--loading' : ''}`}
					initial={prefersReducedMotion ? false : { opacity: 0 }}
					whileInView={prefersReducedMotion ? undefined : { opacity: 1 }}
					viewport={prefersReducedMotion ? undefined : { once: true }}
					transition={prefersReducedMotion ? undefined : { delay: 0.2 }}
				>
					{isSubmitting ? 'Enviando...' : buttonLabel}
				</motion.button>
			</form>
		</section>
	);
};

export default RSVP;
