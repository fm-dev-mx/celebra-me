// src/components/ui/ConfirmModal.tsx
import React, { useEffect } from 'react';

// Props interface to define the expected properties for the ConfirmModal component
interface ConfirmModalProps {
  show: boolean; // Determines if the modal is visible
  onClose: () => void; // Function to close the modal
  onConfirm: () => void; // Function to execute when confirmation is accepted
  title?: string; // Optional title of the modal
  message?: string; // Optional message to display inside the modal
  confirmText?: string; // Optional text for the confirm button
  cancelText?: string; // Optional text for the cancel button
  children?: React.ReactNode; // Optional content to be displayed inside the modal for additional customization
}

// Functional component for ConfirmModal
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  show,
  onClose,
  onConfirm,
  title = 'Confirmación', // Default title if not provided
  message = '¿Estás seguro de realizar esta acción?', // Default message if not provided
  confirmText = 'Confirmar', // Default text for confirm button
  cancelText = 'Cancelar', // Default text for cancel button
  children, // Allows adding custom content inside the modal
}) => {

  // UseEffect to add class to confirm buttons containing "WhatsApp"
  useEffect(() => {
    if (show) {
      // Selecciona todos los botones con la clase `.confirm-button`
      document.querySelectorAll(".confirm-button").forEach((button) => {
        // Verifica si el texto del botón incluye "WhatsApp"
        if (button.textContent?.includes("WhatsApp")) {
          // Agrega la clase específica para los botones de WhatsApp
          button.classList.add("confirm-button-whatsapp");
        }
      });
    }
  }, [show]); // Runs when the modal is shown

  // If the modal should not be shown, return null to prevent rendering
  if (!show) return null;

  return (
    <div id="confirm-modal" className={`confirm-modal ${show ? 'show' : ''}`}>
      <div className='modal-container'>
        {/* Modal header with optional title */}
        <div className='modal-header'>
          <h2 className='modal-title'>{title}</h2>
        </div>
        {/* Custom content or default message */}
        {children ? (
          <div className='modal-content'>{children}</div>
        ) : (
          <p className='modal-content'>{message}</p>
        )}
        {/* Action buttons with enhanced styling */}
        <div className='modal-actions'>
          <button onClick={onClose} className='modal-button cancel-button'>
            {cancelText}
          </button>
          <button onClick={onConfirm} className='modal-button confirm-button'>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
