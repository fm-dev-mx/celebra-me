// src/frontend/hooks/contact/useContactForm.tsx

import { useState } from "react";
import { validateInput } from "@/core/utilities/validateInput";
import { validationRules } from "@/core/utilities/validationRules";

/**
 * Contact form data interface.
 */
interface ContactFormData {
	name: string;
	email: string;
	mobile: string;
	message: string;
}

/**
 * Custom hook to manage contact form state and handlers.
 */
export const useContactForm = () => {
	// State to manage the form data
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
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Handle form submission when the user clicks the submit button
	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsSubmitting(true);

		// Client-side validation using shared validation rules
		const validationError = validateInput(
			formData as unknown as Record<string, string>,
			validationRules,
		);
		if (Object.keys(validationError).length > 0) {
			setErrors(validationError);
			setIsSubmitting(false);
			return;
		} else {
			setErrors({});
		}

		try {
			// Sanitize the form data before sending
			const sanitizedData = {
				name: formData.name.trim(),
				email: formData.email.trim(),
				mobile: formData.mobile.trim(),
				message: formData.message.trim(),
			};

			// Send a POST request to the serverless function endpoint
			const response = await fetch("/api/sendEmail", {
				method: "POST",
				headers: {
					"Content-Type": "application/json", // Ensures the server understands the request is JSON
					Accept: "application/json", // Ensures the client expects a JSON response
				},
				body: JSON.stringify(sanitizedData), // Converts the sanitized form data to JSON
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
				console.error("Error data from server:", errorData.fieldErrors);
				setResponseMessage("Ha ocurrido un error al enviar el mensaje.");
			}
		} catch (error: unknown) {
			// Handle network errors or unexpected exceptions
			if (error instanceof Error) {
				console.error("Network or unexpected error:", error.message);
			} else {
				console.error("An unknown error occurred.");
			}
			setResponseMessage("Ha ocurrido un error al enviar el mensaje.");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Handle form input change when the user types in the input fields
	const handleInputChange = (
		event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		const { name, value } = event.target;

		// Update the form data state
		setFormData((prevFormData) => ({
			...prevFormData,
			[name]: value,
		}));
	};

	// Handle the blur event of the input fields
	const handleBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = event.target;

		// Validate only the field that just lost focus using shared validation rules
		const fieldErrors = validateInput(
			{ [name]: value },
			{ [name]: validationRules[name as keyof typeof validationRules] },
		);

		// Update the error state with any validation errors
		setErrors((prevErrors) => ({
			...prevErrors,
			[name]: fieldErrors[name],
		}));
	};

	// Determine the button text based on the current state
	const getButtonText = () => {
		if (isSubmitting) return "Enviando...";
		if (isRateLimited) return "Demasiados intentos";
		return "Enviar Mensaje";
	};

	return {
		formData,
		errors,
		responseMessage,
		isSubmitting,
		isRateLimited,
		handleSubmit,
		handleInputChange,
		handleBlur,
		getButtonText,
	};
};
