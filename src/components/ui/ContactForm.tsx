import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ContactForm: React.FC = () => {
	const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setStatus('submitting');

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 2000));
		setStatus('success');
	};

	return (
		<div className="contact-card">
			<form className="contact-form" onSubmit={handleSubmit}>
				<div className="input-group">
					<input
						type="text"
						id="name"
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
						className="input-group__input input-group__input--textarea"
						required
						placeholder=" "
					></textarea>
					<label htmlFor="message" className="input-group__label">
						Detalles de su Evento
					</label>
				</div>

				<button type="submit" className="submit-btn" disabled={status === 'submitting'}>
					{status === 'submitting' ? 'Enviando Solicitud...' : 'Solicitar Asesoría'}
				</button>

				<AnimatePresence>
					{status === 'success' && (
						<motion.p
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="form-feedback form-feedback--success"
						>
							Solicitud enviada. Un asesor le contactará a la brevedad.
						</motion.p>
					)}
					{status === 'error' && (
						<motion.p
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className="form-feedback form-feedback--error"
						>
							Ocurrió un error. Por favor, intente de nuevo.
						</motion.p>
					)}
				</AnimatePresence>
			</form>
		</div>
	);
};

export default ContactForm;
