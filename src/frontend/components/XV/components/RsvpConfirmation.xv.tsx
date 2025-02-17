/*
 * src/frontend/components/XV/components/RsvpConfirmation.xv.tsx
 * -------------------------------------------------------------
 * RsvpConfirmation TypeScript Component (XV)
 * -------------------------------------------------------------
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

// WhatsApp configuration: Replace with your actual phone number in international format (omit '+' sign).
const WHATSAPP_PHONE = '526681095162';

// Default guest cap if the URL parameter is absent or invalid.
const DEFAULT_GUEST_CAP = 2;

// URL parameter name for setting the guest cap subtly.
const GUEST_CAP_PARAM = 'cap';

// Type definition for form errors.
interface FormErrors {
	name?: string;
	phone?: string;
	guests?: string;
}

/**
 * Generates a properly encoded WhatsApp URL with a pre-filled message.
 * Uses the universal API endpoint for consistent behavior across devices.
 *
 * @param message - The message to be sent via WhatsApp.
 * @returns The full WhatsApp URL.
 */
const getWhatsAppUrl = (message: string): string => {
	const encodedMessage = encodeURIComponent(message);
	const baseUrl = 'https://api.whatsapp.com/send';
	return `${baseUrl}?phone=${WHATSAPP_PHONE}&text=${encodedMessage}`;
};

/**
 * RsvpConfirmation Component
 *
 * Renders the RSVP confirmation form, allowing guests to confirm attendance.
 * The guest cap can be configured via the URL using a subtle parameter (e.g., ?cap=5).
 * Includes form validation, a confirmation modal, and WhatsApp integration.
 */
const RsvpConfirmation: React.FC = () => {
	// Form field states.
	const [name, setName] = useState<string>('');
	const [phone, setPhone] = useState<string>('');
	const [attendance, setAttendance] = useState<'attending' | 'not-attending'>('attending');
	const [guests, setGuests] = useState<string>('');
	const [errors, setErrors] = useState<FormErrors>({});
	const [showModal, setShowModal] = useState<boolean>(false);

	// Guest cap state, updated on the client side.
	const [guestCap, setGuestCap] = useState<number>(DEFAULT_GUEST_CAP);

	/**
	 * Updates guest cap from the URL parameter once the component is mounted on the client.
	 */
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			const capParam = params.get(GUEST_CAP_PARAM);
			const parsed = Number(capParam);
			if (!isNaN(parsed) && parsed > 0) {
				setGuestCap(parsed);
			}
		}
	}, []);

	/**
	 * Closes the confirmation modal.
	 */
	const handleGoBack = useCallback(() => {
		setShowModal(false);
	}, []);

	/**
	 * Closes the modal when the Escape key is pressed.
	 */
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
	 *
	 * @returns True if the form is valid, false otherwise.
	 */
	const validateForm = (): boolean => {
		let valid = true;
		const newErrors: FormErrors = {};

		if (name.trim() === '') {
			newErrors.name = 'El nombre es obligatorio.';
			valid = false;
		}
		if (phone.trim() === '') {
			newErrors.phone = 'El teléfono es obligatorio.';
			valid = false;
		}
		// Validate guest count only when attendance is confirmed.
		if (attendance === 'attending' && guests.trim() !== '') {
			const numGuests = Number(guests);
			if (isNaN(numGuests) || numGuests < 1 || numGuests > guestCap) {
				newErrors.guests = `La invitación es para un máximo de ${guestCap} personas.`;
				valid = false;
			}
		}
		setErrors(newErrors);
		return valid;
	};

	/**
	 * Generates the WhatsApp message based on guest details.
	 *
	 * @returns The formatted WhatsApp message.
	 */
	const generateWhatsAppMessage = useCallback((): string => {
		if (attendance === 'attending') {
			const totalAttendees = guests.trim() === '' ? 1 : Number(guests.trim());
			return `¡Hola! Confirmo mi asistencia. Soy ${name} (tel: ${phone}). En total, seremos ${totalAttendees} ${totalAttendees > 1 ? 'personas' : 'persona'}.`;
		}
		return `¡Hola! Soy ${name} y, lamentablemente, no podré asistir. Les deseo un evento maravilloso y mucho éxito.`;
	}, [name, phone, guests, attendance]);

	/**
	 * Handles form submission by validating inputs and showing the confirmation modal.
	 *
	 * @param e - The form submission event.
	 */
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (validateForm()) {
			setShowModal(true);
		}
	};

	/**
	 * Handles final confirmation to send the RSVP via WhatsApp.
	 * Opens WhatsApp in a new tab with the pre-filled message.
	 */
	const handleConfirmSend = useCallback(() => {
		const message = generateWhatsAppMessage();
		const whatsappUrl = getWhatsAppUrl(message);
		setShowModal(false);
		window.open(whatsappUrl, '_blank');
	}, [generateWhatsAppMessage]);

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

				{/* Attendance Options */}
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

				{/* Guest Count Field or Not-Attending Message */}
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
								min="1"
								max={guestCap}
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

			{/* Confirmation Modal rendered via Portal */}
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
