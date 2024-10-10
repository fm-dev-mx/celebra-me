// src/components/ui/ContactForm.tsx
import React, { useState } from "react";
import Input from "@/components/form/Input";
import TextArea from "@/components/form/TextArea";
import { validateInput } from "@/utilities/validateInput";

/**
 * Contact form data interface.
 * @interface ContactFormData
 * @property {string} name - The name of the contact form.
 * @property {string} email - The email address of the contact form.
 * @property {string} mobile - The mobile number of the contact form.
 * @property {string} message - The message entered by the user.
 */
export interface ContactFormData {
	name: string;
	email: string;
	mobile: string;
	message: string;
}

const ContactForm: React.FC = () => {
	// State to manage the form data, initially empty
	const [formData, setFormData] = useState<ContactFormData>({
		name: "",
		email: "",
		mobile: "",
		message: "",
	});

	// State to store response messages from the server for user feedback
	const [responseMessage, setResponseMessage] = useState<string | null>(null);

	// State to track submission status
	const [isSubmitting, setIsSubmitting] = useState(false);

	// State to handle rate limiting
	const [isRateLimited, setIsRateLimited] = useState(false);

	// State to store client-side validation errors
	const [errors, setErrors] = useState<Partial<ContactFormData>>({});

	/**
	 * Handle form submission when the user clicks the submit button.
	 * Sends a POST request to the serverless function to process the form data.
	 * @param event - Form submit event.
	 */
	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsSubmitting(true);

		// Client-side validation
		const validationError = validateInput(formData);
		if (Object.keys(validationError).length > 0) {
			setErrors(validationError);
			setIsSubmitting(false);
			return;
		} else {
			setErrors({});
		}

		try {
			// Send a POST request to the serverless function endpoint
			const response = await fetch("/api/sendEmail", {
				method: "POST",
				headers: {
					"Content-Type": "application/json", // Ensures the server understands the request is JSON
					Accept: "application/json", // Ensures the client expects a JSON response
				},
				body: JSON.stringify(formData), // Converts the form data to JSON
			});

			// Handle rate limit response or successful email sending response
			if (response.status === 429) {
				// Rate limit response
				setIsRateLimited(true); // Activates rate-limiting state
				setResponseMessage(
					"Has enviado demasiados mensajes. Por favor, intenta de nuevo más tarde.",
				);
			} else if (response.ok) {
				// Successful email sending
				setIsRateLimited(false); // Reset rate-limiting state on success
				setResponseMessage("Hemos recibido tu mensaje, te responderemos muy pronto.");
				setFormData({
					name: "",
					email: "",
					mobile: "",
					message: "",
				});
			} else {
				// If the server response indicates an error, parse and log the error details
				const errorData = await response.json();
				// Display an error message on console
				console.error("Error data from server:", errorData);
				// Display an error message to the user
				setResponseMessage("Ha ocurrido un error al enviar el mensaje.");
			}
		} catch (error: unknown) {
			// Properly handle the error typed as 'unknown'
			if (error instanceof Error) {
				console.error("Network error:", error.message);
			} else {
				console.error("An unknown error occurred.");
			}
			setResponseMessage("Ha ocurrido un error al enviar el mensaje.");
		} finally {
			setIsSubmitting(false);
		}
	};

	/**
	 * Handle form input change that occurs when the user types in the input fields.
	 * @param event - Input change event
	 */
	const handleInputChange = (
		event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		// Get the name and value of the input
		const { name, value } = event.target;

		// Update the form data state
		setFormData((prevFormData) => ({
			...prevFormData,
			[name]: value,
		}));
	};

	/**
	 * Handles the blur event of the input fields.
	 * Validates the input and updates the error state.
	 * @param event - Input blur event
	 */
	const handleBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = event.target;

		// Validate only the field that just lost focus
		const fieldErrors = validateInput({
			...formData,
			[name]: value,
		});

		// Update the error state with any validation errors
		setErrors((prevErrors) => ({
			...prevErrors,
			[name]: fieldErrors[name as keyof ContactFormData],
		}));
	};

	// Determine the button text based on the current state
	const getButtonText = () => {
		if (isSubmitting) return "Enviando...";
		if (isRateLimited) return "Demasiados intentos";
		return "Enviar Mensaje";
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col space-y-6 w-5/6 sm:w-3/4 md:w-2/3 lg:w-7/12 xl:w-1/2"
			noValidate
		>
			{/* Input for Name */}
			<Input
				label="Nombre"
				type="text"
				placeholder="Ingresa tu primer nombre"
				required
				value={formData.name}
				onChange={handleInputChange}
				onBlur={handleBlur}
				name="name"
				error={errors.name}
			/>

			{/* Input for Email */}
			<Input
				label="Email"
				type="email"
				placeholder="Ingresa tu correo"
				required
				value={formData.email}
				onChange={handleInputChange}
				onBlur={handleBlur}
				name="email"
				error={errors.email}
			/>

			{/* Input for Mobile */}
			<Input
				label="Teléfono"
				type="tel"
				placeholder="Ingresa tu teléfono"
				required
				value={formData.mobile}
				onChange={handleInputChange}
				onBlur={handleBlur}
				name="mobile"
				error={errors.mobile}
			/>

			{/* Text Area for Message */}
			<TextArea
				label="Mensaje"
				placeholder="Menciona la fecha, tipo de evento y cualquier detalle importante"
				required
				rows={8}
				value={formData.message}
				onChange={handleInputChange}
				onBlur={handleBlur}
				name="message"
				error={errors.message}
			/>

			{/* Submit Button */}
			<div className="flex justify-center items-center">
				<button
					type="submit"
					className="w-5/6 md:w-2/3 lg:w-3/4 xl:w-1/2 inline-flex items-center justify-center text-nowrap text-base px-14 py-2 shadow-2xl bg-accent text-white hover:bg-accent-dark transition-all duration-500 ease-in-out rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={isSubmitting || isRateLimited} // Disable button on submit or rate-limited
				>
					{getButtonText()}
				</button>
			</div>

			{/* Display response message if any */}
			{responseMessage && (
				<p className="text-center mt-4" aria-live="polite">
					{responseMessage}
				</p>
			)}
		</form>
	);
};

export default ContactForm;
