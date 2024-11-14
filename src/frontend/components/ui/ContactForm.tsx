// src/components/ui/ContactForm.tsx

import Input from "@/frontend/components/form/Input";
import TextArea from "@/frontend/components/form/TextArea";
import { useContactForm } from "@/frontend/hooks/contact/useContactForm";

/**
 * ContactForm component renders the contact form.
 */
const ContactForm = () => {
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
				placeholder="Ingresa tu nombre"
				required
				value={formData.name}
				onChange={handleInputChange}
				onBlur={handleBlur}
				name="name"
				error={errors.name}
				id="name"
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
				id="email"
			/>
			<Input
				label="Teléfono"
				type="tel"
				placeholder="Ingresa tu teléfono"
				value={formData.mobile}
				onChange={handleInputChange}
				onBlur={handleBlur}
				name="mobile"
				error={errors.mobile}
				id="mobile"
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
				id="message"
			/>

			{/* Submit Button */}
			<div className="flex justify-center items-center">
				<button
					type="submit"
					className="w-5/6 md:w-2/3 lg:w-3/4 xl:w-1/2 inline-flex items-center justify-center text-nowrap text-base px-14 py-2 shadow-2xl bg-accent text-white hover:bg-accent-dark transition-all duration-500 ease-in-out rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={isSubmitting || isRateLimited}
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
