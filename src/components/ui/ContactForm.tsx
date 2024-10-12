// src/components/ui/ContactForm.tsx

import React from "react"; // Import React for JSX transformation
import Input from "@/components/form/Input";
import TextArea from "@/components/form/TextArea";
import { useContactForm } from "@/hooks/contact/useContactForm";

/**
 * ContactForm component renders the contact form.
 */
const ContactForm: React.FC = () => {
	const {
		formData,
		errors,
		responseMessage,
		isSubmitting,
		isRateLimited,
		handleSubmit,
		handleInputChange,
		handleBlur,
		getButtonText,
	} = useContactForm();

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col space-y-6 w-5/6 sm:w-3/4 md:w-2/3 lg:w-7/12 xl:w-1/2"
			noValidate
		>
			{/* Input Fields */}
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
				id="name" // Added id for accessibility
			/>
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
				id="email" // Added id for accessibility
			/>
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
				id="mobile" // Added id for accessibility
			/>
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
				id="message" // Added id for accessibility
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
