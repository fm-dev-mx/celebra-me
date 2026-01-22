import React from 'react';

const ContactForm: React.FC = () => {
  return (
    <form className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-4">
        <label className="block text-gray-700">Nombre</label>
        <input type="text" className="w-full border p-2 rounded" />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Email</label>
        <input type="email" className="w-full border p-2 rounded" />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Mensaje</label>
        <textarea className="w-full border p-2 rounded"></textarea>
      </div>
      <button type="submit" className="bg-primary text-white px-6 py-2 rounded-full">Enviar</button>
    </form>
  );
};

export default ContactForm;
