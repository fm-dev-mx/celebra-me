import type { FC, SubmitEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContactPayload } from '@/lib/client/rsvp-api';
import { useContactSubmission } from '@/hooks/use-contact-submission';

const ContactForm: FC = () => {
	const { submitting, error, submitted, submitContact, resetContactSubmission } =
		useContactSubmission();

	const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		resetContactSubmission();

		try {
			const formData = new FormData(e.currentTarget);
			const data = Object.fromEntries(formData.entries()) as unknown as ContactPayload;

			await submitContact(data);
			e.currentTarget.reset();
		} catch {
			// The hook preserves the current error state for the feedback message.
		}
	};

	return (
		<div className="contact-card">
			<form className="contact-form" onSubmit={handleSubmit}>
				<div className="input-group">
					<input
						type="text"
						id="name"
						name="name"
						className="input-group__input"
						required
						placeholder=" "
					/>
					<label htmlFor="name" className="input-group__label">
						Nombre Completo
					</label>
				</div>

				<div className="input-group">
					<input
						type="email"
						id="email"
						name="email"
						className="input-group__input"
						required
						placeholder=" "
					/>
					<label htmlFor="email" className="input-group__label">
						Correo Electrónico
					</label>
				</div>

				<div className="input-group">
					<textarea
						id="message"
						name="message"
						className="input-group__input input-group__input--textarea"
						required
						placeholder=" "
					></textarea>
					<label htmlFor="message" className="input-group__label">
						Detalles de su Evento
					</label>
				</div>

				<button type="submit" className="submit-btn" disabled={submitting}>
					{submitting ? 'Enviando Solicitud...' : 'Solicitar Asesoría'}
				</button>

				<AnimatePresence>
					{submitted && (
						<motion.p
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="form-feedback form-feedback--success"
						>
							Solicitud enviada. Un asesor le contactará a la brevedad.
						</motion.p>
					)}
					{error && (
						<motion.p
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="form-feedback form-feedback--error"
						>
							{error}
						</motion.p>
					)}
				</AnimatePresence>
			</form>
		</div>
	);
};

export default ContactForm;
