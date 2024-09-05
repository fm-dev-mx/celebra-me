import React, { useState } from "react";
import Input from "@/components/form/Input";
import TextArea from "@/components/form/TextArea";

// Define the interface for the form data structure
interface ContactFormData {
  name: string;
  email: string;
  mobile: string;
  message: string;
}

const ContactForm: React.FC = () => {
  // State to manage the form data, initialized with empty values
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
	mobile: "",
    message: "",
  });

  // State to store response messages from the server for user feedback
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  // Handles form submission when the user clicks the submit button
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent the default form submission behavior

    // Log the data to verify correct values are being sent
    console.log("Data sent:", formData);

    try {
      // Send a POST request to the serverless function endpoint
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", // Ensures the server understands the request is JSON
          "Accept": "application/json", // Ensures the client expects a JSON response
        },
        body: JSON.stringify(formData), // Convert form data to JSON format
      });

      // Check if the response from the server was successful
      if (response.ok) {
        setResponseMessage("Hemos recibido tu mensaje, te responderemos muy pronto."); // Display success message to the user
      } else {
        // If the server response indicates an error, parse and log the error details
        const errorData = await response.json();
        console.error("Error data from server:", errorData);
        setResponseMessage("Ha ocurrido un error al enviar el mensaje"); // Display failure message to the user
      }
    } catch (error) {
      // Handle network errors and log the error details
      console.error("Network error:", error);
      setResponseMessage("An error occurred while sending the message"); // Display a generic error message
    }

    // Reset the form data after submission to clear the input fields
    setFormData({
      name: "",
      email: "",
	  mobile: "",
      message: "",
    });
  };

  // Handles changes to input fields and updates the form data state
  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target; // Extract the name and value from the event target
    setFormData({
      ...formData,
      [name]: value, // Update the corresponding field in the form data
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-6 w-5/6 sm:w-3/4 md:w-2/3 lg:w-7/12 xl:w-1/2">
      {/* Input for Name */}
      <Input
        label="Nombre"
        type="text"
        placeholder="Ingresa tu primer nombre"
        required
        value={formData.name}
        onInput={handleInputChange}
        name="name"
      />

      {/* Input for Email */}
      <Input
        label="Email"
        type="email"
        placeholder="Ingresa tu correo"
        required
        value={formData.email}
        onInput={handleInputChange}
        name="email"
      />

	  {/* Input for Mobile */}
      <Input
        label="Teléfono"
        type="text"
        placeholder="Ingresa tu teléfono"
        required
        value={formData.mobile}
        onInput={handleInputChange}
        name="mobile"
      />

      {/* Text Area for Message */}
      <TextArea
        label="Mensaje"
        placeholder="Menciona la fecha, tipo de evento y cualquier detalle importante"
        required
        rows={8}
        value={formData.message}
        onInput={handleInputChange}
        name="message"
      />

      {/* Submit Button */}
      <div className="flex justify-center items-center">
        <button
          type="submit"
          className="w-5/6 md:w-2/3 lg:w-3/4 xl:w-1/2 inline-flex items-center justify-center text-nowrap text-base px-14 py-2 shadow-2xl bg-accent text-white hover:bg-accent-dark transition-all duration-500 ease-in-out rounded-sm"
        >
          Enviar Mensaje
        </button>
      </div>

      {/* Display the response message to the user if available */}
      {responseMessage && <p className="text-center mt-4">{responseMessage}</p>}
    </form>
  );
};

export default ContactForm;
