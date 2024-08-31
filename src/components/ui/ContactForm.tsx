import React, { useState } from "react";
import Input from "@/components/form/Input";
import TextArea from "@/components/form/TextArea";

// Define the interface for the form data
interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

const ContactForm: React.FC = () => {
  // Initialize the form data with empty values
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    message: "",
  });

  // State to store response messages for the user
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  // Function to handle form submission
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      // Send a POST request to the serverless function with the form data
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // If the request was successful, set a success message
        setResponseMessage('Message sent successfully');
      } else {
        // If the request failed, set an error message
        setResponseMessage('Failed to send message');
      }
    } catch (error) {
      // Catch any network errors and set an error message
      setResponseMessage('An error occurred while sending the message');
    }

    // Reset the form data after submission
    setFormData({
      name: "",
      email: "",
      message: "",
    });
  };

  // Function to handle input changes
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
      {/* Name Input Field */}
      <Input
        label="Nombre"
        type="text"
        placeholder="Ingresa tu primer nombre"
        required={true}
        value={formData.name}
        onInput={handleInputChange}
        name="name"
      />

      {/* Email Input Field */}
      <Input
        label="Email"
        type="email"
        placeholder="Ingresa tu correo"
        required={true}
        value={formData.email}
        onInput={handleInputChange}
        name="email"
      />

      {/* Message TextArea */}
      <TextArea
        label="Mensaje"
        placeholder="Escribe aquí como te podemos ayudar"
        required={true}
        rows={5}
        value={formData.message}
        onInput={handleInputChange}
        name="message"
      />

      {/* Submit Button */}
			{/* <ActionWrapper margin="my-16">
				<Action variant="tertiary" color="accent" href="#" title="Cuéntanos sobre tu evento">
					Enviar Mensaje
				</Action>
			</ActionWrapper> */}
      <div className="my-16 flex justify-center items-center">
        <button
          type="submit"
          className="inline-flex items-center justify-center text-lg px-14 py-2 shadow-2xl bg-accent text-white hover:bg-accent-dark transition-all duration-300"
        >
          Enviar Mensaje
        </button>
      </div>

      {/* Display response message */}
      {responseMessage && <p className="text-center mt-4">{responseMessage}</p>}
    </form>
  );
};

export default ContactForm;
