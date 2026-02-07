import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '@/styles/invitation/_rsvp.scss';

interface RSVPProps {
	title: string;
	guestCap: number;
	confirmationMessage: string;
}

const RSVP: React.FC<RSVPProps> = ({ title, guestCap, confirmationMessage }) => {
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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!name || !attendance) {
			setError('Por favor, completa los campos obligatorios.');
			return;
		}

		if (attendance === 'yes' && guestCount > guestCap) {
			setError(`El límite de invitados es de ${guestCap}.`);
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch('/api/rsvp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					attendance,
					guestCount: attendance === 'yes' ? guestCount : 0,
					notes,
					dietary,
				}),
			});

			if (response.ok) {
				setSubmitted(true);
			} else {
				const data = await response.json();
				setError(data.message || 'Ocurrió un error al enviar tu confirmación.');
			}
		} catch (err) {
			setError('No se pudo conectar con el servidor.');
		} finally {
			setIsSubmitting(false);
		}
	};

	if (submitted) {
		return (
			<section className="rsvp">
				<div className="rsvp__greeting">
					<span className="rsvp__greeting-icon" role="img" aria-label="Celebration">
						{attendance === 'yes' ? '✨' : '✉️'}
					</span>
					<h2 className="rsvp__greeting-message">
						{attendance === 'yes' ? (
							<>¡Gracias, <strong>{name}</strong>!<br />{confirmationMessage}</>
						) : (
							<>Gracias por avisarnos, <strong>{name}</strong>. Te extrañaremos.</>
						)}
					</h2>
					<p className="rsvp__greeting-submessage">Tu respuesta ha sido registrada.</p>
				</div>
			</section>
		);
	}

	return (
		<section id="rsvp" className="rsvp">
			<h2 className="rsvp__title">{title}</h2>

			<form onSubmit={handleSubmit} className="rsvp__form">
				<motion.div
					className="rsvp__field"
					initial={{ opacity: 0, y: 10 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
				>
					<label htmlFor="name">Tu nombre completo *</label>
					<input
						type="text"
						id="name"
						placeholder="Escribe tu nombre"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
					/>
				</motion.div>

				<motion.div
					className="rsvp__field"
					initial={{ opacity: 0, y: 10 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ delay: 0.1 }}
				>
					<label>¿Asistirás al evento? *</label>
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
							No podré
						</label>
					</div>
				</motion.div>

				<AnimatePresence>
					{attendance === 'yes' && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: 'auto' }}
							exit={{ opacity: 0, height: 0 }}
							className="rsvp__extra-fields"
						>
							<div className="rsvp__field">
								<label htmlFor="guestCount">Número de acompañantes (Máx. {guestCap})</label>
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

							<div className="rsvp__field">
								<label htmlFor="dietary">Alergias o restricciones alimentarias</label>
								<textarea
									id="dietary"
									placeholder="Ej. Vegetariano, alergia al maní..."
									rows={2}
									value={dietary}
									onChange={(e) => setDietary(e.target.value)}
								/>
							</div>

							<div className="rsvp__field">
								<label htmlFor="notes">Mensaje adicional (Opcional)</label>
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

				{error && <p className="rsvp__error">{error}</p>}

				<motion.button
					type="submit"
					disabled={isSubmitting || !attendance}
					className={`rsvp__button ${isSubmitting ? 'rsvp__button--loading' : ''}`}
					initial={{ opacity: 0 }}
					whileInView={{ opacity: 1 }}
					viewport={{ once: true }}
					transition={{ delay: 0.2 }}
				>
					{isSubmitting ? 'Enviando...' : 'Confirmar Asistencia'}
				</motion.button>
			</form>
		</section>
	);
};

export default RSVP;
