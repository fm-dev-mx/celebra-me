// src\components\ui\WhatsAppButton.tsx
import React from 'react';
import ActionExternalLink from '@/components/common/actions/ActionExternalLink';

// Configuration for WhatsApp URL and messages
const PHONE_NUMBER = '526681167477';
const DEFAULT_MESSAGE = 'Hola, vi tus invitaciones en celebra-me.com y me gustaría conocer más sobre sus servicios.';
const WHATSAPP_URL = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

// Configuration for modal messages
const MODAL_CONFIG = {
  title: '¡Estamos a un mensaje de distancia!',
  message: '¿Quieres recibir atención personalizada por WhatsApp?',
  confirmButtonText: 'Ir a WhatsApp',
  cancelButtonText: 'No, volver atrás',
};

const WhatsAppButton: React.FC = () => {
  return (
    <ActionExternalLink
      href={WHATSAPP_URL}
      variant="whatsapp"
      confirmTitle={MODAL_CONFIG.title}
      confirmMessage={MODAL_CONFIG.message}
      confirmButtonText={MODAL_CONFIG.confirmButtonText}
      cancelButtonText={MODAL_CONFIG.cancelButtonText}
    >
      <span className="whatsapp-icon"></span> {/* Optional: Add a WhatsApp icon here */}
      <span className="whatsapp-text">WhatsApp</span>
    </ActionExternalLink>
  );
};

export default WhatsAppButton;
