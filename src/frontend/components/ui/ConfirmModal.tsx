// src/frontend/components/ui/ConfirmModal.tsx

import React, { useEffect, useRef, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import styles from '@styles/components/confirmModal.module.scss';

export interface ConfirmModalProps {
	/** Controls the modal visibility */
	show: boolean;
	/** Callback to cancel/close the modal */
	onCancel: () => void;
	/** Callback to confirm the action */
	onConfirm: () => void;
	/** Optional modal title */
	title?: string;
	/** Optional modal message */
	message?: string;
	/** Optional text for the confirm button */
	confirmButtonText?: string;
	/** Optional text for the cancel button */
	cancelButtonText?: string;
	/** Optional custom content to render within the modal */
	children?: React.ReactNode;
}

/**
 * ConfirmModal Component
 *
 * This component displays a confirmation modal with a smooth, attractive transition.
 * It uses a portal to render the modal at the body level and includes accessibility enhancements.
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
	show,
	onCancel,
	onConfirm,
	title = 'Confirmation',
	message = 'Are you sure you want to perform this action?',
	confirmButtonText = 'Confirm',
	cancelButtonText = 'Cancel',
	children,
}) => {
	// Ref for the modal container to set focus
	const modalRef = useRef<HTMLDivElement>(null);
	// Local state to trigger CSS transition by adding the '--show' class
	const [isVisible, setIsVisible] = useState(false);

	/**
	 * When 'show' becomes true, trigger the transition by updating 'isVisible'
	 * after the component has mounted. This allows the modal to first render in its
	 * initial (hidden) state, and then animate to the visible state.
	 */
	useEffect(() => {
		if (show) {
			// Using requestAnimationFrame to ensure the initial render is complete
			requestAnimationFrame(() => {
				setIsVisible(true);
			});
		} else {
			// Remove the visible class when 'show' becomes false
			setIsVisible(false);
		}
	}, [show]);

	/**
	 * Focus the modal container when it becomes visible to enhance accessibility.
	 */
	useEffect(() => {
		if (show && modalRef.current) {
			modalRef.current.focus();
		}
	}, [show]);

	/**
	 * Close the modal when the 'Escape' key is pressed.
	 */
	const handleEscape = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onCancel();
			}
		},
		[onCancel],
	);

	/**
	 * Add or remove the 'keydown' event listener based on the modal visibility.
	 */
	useEffect(() => {
		if (show) {
			window.addEventListener('keydown', handleEscape);
			return () => window.removeEventListener('keydown', handleEscape);
		}
	}, [show, handleEscape]);

	/**
	 * Disable body scroll when the modal is visible to prevent background scrolling.
	 */
	useEffect(() => {
		if (show) {
			const originalOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = originalOverflow;
			};
		}
	}, [show]);

	// If 'show' is false, do not render the modal.
	if (!show) return null;

	// Determine if the confirm button should have WhatsApp styling.
	const isWhatsAppButton = confirmButtonText.includes('WhatsApp');

	/**
	 * Build the modal content.
	 * The '--show' class is conditionally added based on the 'isVisible' state,
	 * triggering the CSS transition for opacity and transform.
	 */
	const modalContent = (
		<div
			ref={modalRef}
			className={styles['confirm-modal']}
			role="dialog"
			aria-labelledby="confirm-modal__title"
			aria-modal="true"
			tabIndex={-1}
		>
			<div
				className={`${styles['confirm-modal__container']} ${isVisible ? styles['confirm-modal__container--show'] : ''}`}
			>
				<header className={styles['confirm-modal__header']}>
					<h2 id="confirm-modal__title" className={styles['confirm-modal__title']}>
						{title}
					</h2>
				</header>
				<div className={styles['confirm-modal__content']}>
					{children || <p>{message}</p>}
				</div>
				<div className={styles['confirm-modal__actions']}>
					<button
						onClick={onCancel}
						className={`${styles['confirm-modal__button']} ${styles['confirm-modal__button--cancel']}`}
					>
						{cancelButtonText}
					</button>
					<button
						onClick={onConfirm}
						className={`
              ${styles['confirm-modal__button']}
              ${styles['confirm-modal__button--confirm']}
              ${isWhatsAppButton ? styles['confirm-modal__button--whatsapp'] : ''}
            `}
					>
						{confirmButtonText}
					</button>
				</div>
			</div>
		</div>
	);

	// Render the modal content using a portal to append it to the document body.
	return ReactDOM.createPortal(modalContent, document.body);
};

export default ConfirmModal;
