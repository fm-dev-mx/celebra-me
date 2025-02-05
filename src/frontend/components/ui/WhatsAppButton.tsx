// src/frontend/components/ui/WhatsAppButton.tsx

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ConfirmModal from '@components/ui/ConfirmModal';
import styles from '@styles/components/whatsAppButton.module.scss';
import { getEnvVariable } from '@config/getEnvVariable';

export interface WhatsAppButtonProps {
	/**
	 * Optional phone number.
	 * If not provided, the component will try to load it from the environment variable 'CONTACT_PHONE'.
	 */
	phoneNumber?: string;
	/**
	 * Optional default message to send.
	 */
	defaultMessage?: string;
	/**
	 * Optional modal configuration to override default texts.
	 */
	modalConfig?: {
		title?: string;
		message?: string;
		confirmButtonText?: string;
		cancelButtonText?: string;
	};
	/**
	 * Optional additional class name(s) for the button.
	 */
	className?: string;
}

/* Default values for the component */
const DEFAULT_MESSAGE =
	'Hola, vi tus invitaciones en celebra-me.com y me gustaría conocer más sobre sus servicios.';
const DEFAULT_MODAL_CONFIG = {
	title: '¡Estamos a un mensaje de distancia!',
	message: '¿Quieres recibir atención personalizada por WhatsApp?',
	confirmButtonText: 'Ir a WhatsApp',
	cancelButtonText: 'No, volver atrás',
};

/**
 * WhatsAppButton Component
 *
 * Renders a styled WhatsApp button that opens a confirmation modal.
 * On confirmation, it opens the WhatsApp chat in a new tab.
 */
const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
	phoneNumber: propPhoneNumber,
	defaultMessage = DEFAULT_MESSAGE,
	modalConfig = {},
	className = '',
}) => {
	const [isModalVisible, setModalVisible] = useState(false);
	const [phoneNumber, setPhoneNumber] = useState<string>(propPhoneNumber || '');

	// Memoize combined modal config
	const mergedModalConfig = useMemo(
		() => ({ ...DEFAULT_MODAL_CONFIG, ...modalConfig }),
		[modalConfig],
	);

	// On component mount, load CONTACT_PHONE from env if phoneNumber prop not provided
	useEffect(() => {
		if (!propPhoneNumber) {
			try {
				const number = getEnvVariable('CONTACT_PHONE');
				setPhoneNumber(number);
			} catch (error) {
				console.error('Error fetching CONTACT_PHONE:', error);
			}
		}
	}, [propPhoneNumber]);

	// Rename computed URL variable for clarity
	const whatsappUrl = useMemo(() => {
		return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(defaultMessage)}`;
	}, [phoneNumber, defaultMessage]);

	// Handler to show the confirmation modal
	const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setModalVisible(true);
	}, []);

	// Handler when the user confirms the action in the modal
	const handleConfirm = useCallback(() => {
		setModalVisible(false);
		window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
	}, [whatsappUrl]);

	// Handler when the user cancels the modal
	const handleCancel = useCallback(() => {
		setModalVisible(false);
	}, []);

	return (
		<>
			<button
				onClick={handleClick}
				className={`${styles['whatsapp-button']} ${className}`}
				type="button"
			>
				<span className={styles['whatsapp-button__icon']} /> {/* WhatsApp icon */}
				<span className={styles['whatsapp-button__text']}>WhatsApp</span>
			</button>
			{isModalVisible && (
				<ConfirmModal
					show
					title={mergedModalConfig.title}
					message={mergedModalConfig.message}
					confirmButtonText={mergedModalConfig.confirmButtonText}
					cancelButtonText={mergedModalConfig.cancelButtonText}
					onConfirm={handleConfirm}
					onCancel={handleCancel}
				/>
			)}
		</>
	);
};

export default WhatsAppButton;
