// src/components/ui/WhatsAppButton.tsx
import React, { useState, useCallback } from 'react';
import Modal from './ConfirmModal';

// Define the WhatsApp number and the default message
const PHONE_NUMBER = '526681167477';
const DEFAULT_MESSAGE = 'Hola, vi tus invitaciones en celebra-me.com y me gustaría conocer más sobre sus servicios.';
const WHATSAPP_URL = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

// Configuration for modal messages
const MODAL_CONFIG = {
	title: '¡Estamos a un mensaje de distancia!',
	message: '¿Quieres recibir atención personalizada por WhatsApp?',
	confirmText: 'Ir a WhatsApp',
	cancelText: 'No, volver atrás',
};

const WhatsAppButton: React.FC = React.memo(() => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Function to show the modal, memoized to avoid recreation
  const handleCTAClick = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  // Function to cancel the action and hide the modal
  const handleCancel = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  // Function to proceed and redirect to WhatsApp with the default message
  const handleContinue = useCallback(() => {
    setIsModalVisible(false);
    window.open(WHATSAPP_URL, '_blank');
  }, []);

  return (
    <div>
      <button
        className="whatsapp-hero-button"
        onClick={handleCTAClick}
        aria-label="Enviar mensaje por WhatsApp"
      >
        <span className="whatsapp-icon"></span>
        <span className="whatsapp-text">WhatsApp</span>
      </button>

      {isModalVisible && (
        <Modal
          show={isModalVisible}
          onClose={handleCancel}
          onConfirm={handleContinue}
          title={MODAL_CONFIG.title}
          message={MODAL_CONFIG.message}
          confirmText={MODAL_CONFIG.confirmText}
          cancelText={MODAL_CONFIG.cancelText}
        />
      )}
    </div>
  );
});

export default WhatsAppButton;
