/*
 * src/frontend/components/XV/components/RsvpConfirmation.xv.tsx
 * -------------------------------------------------------------
 * RsvpConfirmation TypeScript Component (XV)
 * -------------------------------------------------------------
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// WhatsApp configuration (replace with your actual phone number)
// Phone number should be in international format without the '+' sign.
const WHATSAPP_PHONE = '526681095162'; // e.g., "52" for Mexico

// Default maximum number of guests; this value can be adjusted later.
const DEFAULT_MAX_GUESTS = 4;

/**
 * Helper function to generate the proper WhatsApp URL.
 * Previously, the code selected the endpoint based on device type,
 * using 'https://web.whatsapp.com/send' on desktops. However, WhatsApp
 * Web often strips the pre-filled message. To ensure consistency,
 * we now use the universal API endpoint on all devices.
 *
 * @param message - The message to be sent via WhatsApp.
 * @returns The full WhatsApp URL with correct URL encoding.
 */
const getWhatsAppUrl = (message: string): string => {
	const encodedMessage = encodeURIComponent(message);
	// Use the universal API endpoint to guarantee the pre-filled message appears
	const baseUrl = 'https://api.whatsapp.com/send';
	return `${baseUrl}?phone=${WHATSAPP_PHONE}&text=${encodedMessage}`;
};

/**
 * RsvpConfirmation Component
 *
 * Renders the RSVP confirmation form for guests to confirm attendance.
 * Includes form validation, a confirmation modal, and WhatsApp integration.
 *
 * Future Expansion:
 * - Integration with backend APIs to persist RSVP data.
 * - Additional configuration options.
 */
const RsvpConfirmation: React.FC = () => {
	// Form state variables
	const [name, setName] = useState<string>('');
	const [phone, setPhone] = useState<string>('');
	const [attendance, setAttendance] = useState<'attending' | 'not-attending'>('attending');
	const [guests, setGuests] = useState<string>('');
	const [errors, setErrors] = useState<{ name?: string; phone?: string; guests?: string }>({});
	const [showModal, setShowModal] = useState<boolean>(false);
	const [formSubmitted, setFormSubmitted] = useState<boolean>(false);
	const [maxGuests, setMaxGuests] = useState<number>(DEFAULT_MAX_GUESTS);

	// Update maximum guest count from URL parameters if available.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const maxParam = params.get('max');
		if (maxParam && !isNaN(Number(maxParam))) {
			setMaxGuests(Number(maxParam));
		}
	}, []);

	// Allow the guest to close the modal via the Escape key for accessibility.
	const handleGoBack = useCallback(() => {
		setShowModal(false);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && showModal) {
				handleGoBack();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [showModal, handleGoBack]);

	/**
	 * Validates form fields and sets error messages.
	 * Returns true if all required fields are valid.
	 */
	const validateForm = (): boolean => {
		let valid = true;
		const newErrors: { name?: string; phone?: string; guests?: string } = {};

		if (name.trim() === '') {
			newErrors.name = 'El nombre es obligatorio.';
			valid = false;
		}
		if (phone.trim() === '') {
			newErrors.phone = 'El teléfono es obligatorio.';
			valid = false;
		}
		// Validate guest count only when confirming attendance and if input is provided.
		if (attendance === 'attending' && guests.trim() !== '') {
			const numGuests = Number(guests);
			if (isNaN(numGuests) || numGuests < 1 || numGuests > maxGuests) {
				newErrors.guests = 'La invitación es para máximo ' + maxGuests + ' personas.';
				valid = false;
			}
		}
		setErrors(newErrors);
		return valid;
	};

	/**
	 * Generates the WhatsApp message confirming the guest's attendance.
	 * Clarifies that the guest is confirming their own attendance.
	 */
	const generateWhatsAppMessage = (): string => {
		if (attendance === 'attending') {
			const totalAttendees = guests.trim() === '' ? 1 : Number(guests.trim());
			return `¡Hola! Confirmo mi asistencia. Soy ${name} (tel: ${phone}). En total, seremos ${totalAttendees} ${totalAttendees > 1 ? 'personas' : 'persona'}.`;
		}
		return `¡Hola! Soy ${name} y, lamentablemente, no podré asistir. Les deseo un evento maravilloso y mucho éxito.`;
	};

	/**
	 * Handles form submission by validating inputs and displaying the confirmation modal.
	 */
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (validateForm()) {
			setShowModal(true);
		}
	};

	/**
	 * Handles confirmation from the modal:
	 * Constructs the WhatsApp URL and opens it in a new tab.
	 *
	 * Future Expansion:
	 * - Persist RSVP details via an API before redirecting.
	 */
	const handleConfirmSend = useCallback(() => {
		const message = generateWhatsAppMessage();
		const whatsappUrl = getWhatsAppUrl(message);
		setShowModal(false);
		setFormSubmitted(true);
		window.open(whatsappUrl, '_blank');
	}, [name, phone, guests, attendance, maxGuests]);

	return (
		<section className="rsvp">
			<form className="rsvp__form" onSubmit={handleSubmit} noValidate>
				{/* Guest Name Field */}
				<div className="rsvp__field">
					<label htmlFor="name">Nombre Completo</label>
					<input
						type="text"
						id="name"
						name="name"
						placeholder="Tu nombre"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						aria-required="true"
					/>
					{errors.name && <span className="rsvp__error">{errors.name}</span>}
				</div>

				{/* Phone Field */}
				<div className="rsvp__field">
					<label htmlFor="phone">Teléfono</label>
					<input
						type="tel"
						id="phone"
						name="phone"
						placeholder="Tu teléfono"
						value={phone}
						onChange={(e) => setPhone(e.target.value)}
						required
						aria-required="true"
					/>
					{errors.phone && <span className="rsvp__error">{errors.phone}</span>}
				</div>

				{/* Attendance Option */}
				<div className="rsvp__field">
					<div className="rsvp__radio-group">
						<label>
							<input
								type="radio"
								name="attendance"
								value="attending"
								checked={attendance === 'attending'}
								onChange={() => setAttendance('attending')}
							/>
							Asistiré
						</label>
						<label>
							<input
								type="radio"
								name="attendance"
								value="not-attending"
								checked={attendance === 'not-attending'}
								onChange={() => setAttendance('not-attending')}
							/>
							Lamentablemente, no podré asistir
						</label>
					</div>
				</div>

				{/* Guest Count Field or "Not Attending" Message */}
				<div className="rsvp__field">
					{attendance === 'attending' ? (
						<>
							<label htmlFor="guests">Número de invitados</label>
							<input
								type="number"
								id="guests"
								name="guests"
								placeholder="Número de invitados"
								value={guests}
								onChange={(e) => setGuests(e.target.value)}
							/>
							{errors.guests && <span className="rsvp__error">{errors.guests}</span>}
						</>
					) : (
						<p className="rsvp__message-not-attending">
							Lamentablemente, no podré asistir
						</p>
					)}
				</div>

				{/* Submit Button */}
				<button type="submit" className="rsvp__button">
					{attendance === 'attending' ? 'Confirmar asistencia' : 'Enviar mensaje'}
				</button>
			</form>

			{/* Confirmation Modal rendered via Portal for proper layering */}
			{showModal &&
				createPortal(
					<div
						className="modal active"
						id="confirmationModal"
						role="dialog"
						aria-modal="true"
						aria-labelledby="modalHeader"
					>
						<div className="modal__content">
							<div className="modal__header" id="modalHeader">
								Verifica tus datos
							</div>
							<div className="modal__body">
								<div id="modalSummary">
									<p>{generateWhatsAppMessage()}</p>
								</div>
							</div>
							<div className="modal__footer">
								<button
									type="button"
									className="modal__button modal__button--cancel"
									onClick={handleGoBack}
								>
									Volver
								</button>
								<button
									type="button"
									className="modal__button modal__button--confirm"
									onClick={handleConfirmSend}
								>
									Enviar vía WhatsApp
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</section>
	);
};

export default RsvpConfirmation;
