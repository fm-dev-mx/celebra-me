import React, { useEffect } from "react";
import ActionBase from "@/frontend/components/common/actions/ActionBase"; // Import ActionBase for general button styles.

// Props interface to define the expected properties for the ConfirmModal component
interface ConfirmModalProps {
	show: boolean; // Determines if the modal is visible
	onCancel: () => void; // Function to close the modal
	onConfirm: () => void; // Function to execute when confirmation is accepted
	title?: string; // Optional title of the modal
	message?: string; // Optional message to display inside the modal
	confirmButtonText?: string; // Optional text for the confirm button
	cancelButtonText?: string; // Optional text for the cancel button
	children?: React.ReactNode; // Optional content to be displayed inside the modal for additional customization
}

// Functional component for ConfirmModal
const ConfirmModal: React.FC<ConfirmModalProps> = ({
	show,
	onCancel,
	onConfirm,
	title = "Confirmación", // Default title if not provided
	message = "¿Estás seguro de realizar esta acción?", // Default message if not provided
	confirmButtonText = "Confirmar", // Default text for confirm button
	cancelButtonText = "Cancelar", // Default text for cancel button
	children, // Allows adding custom content inside the modal
}) => {
	// Focus on the modal when it opens for better accessibility
	useEffect(() => {
		if (show) {
			const modal = document.getElementById("confirm-modal");
			modal?.focus();

			// Select all buttons with the class ".confirm-button"
			document.querySelectorAll(".confirm-button").forEach((button) => {
				// Verify if the button text includes "WhatsApp"
				if (button.textContent?.includes("WhatsApp")) {
					// Add the specific class for WhatsApp buttons
					button.classList.add("confirm-button-whatsapp");
				}
			});
		}
	}, [show]);

	// Close modal on Escape key press for better usability
	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onCancel();
			}
		};

		if (show) {
			window.addEventListener("keydown", handleEscape);
		} else {
			window.removeEventListener("keydown", handleEscape);
		}

		return () => {
			window.removeEventListener("keydown", handleEscape);
		};
	}, [show, onCancel]);

	// If the modal should not be shown, return null to prevent rendering
	if (!show) return null;

	return (
		<div
			id="confirm-modal"
			className={`confirm-modal ${show ? "show" : ""}`}
			role="dialog"
			aria-labelledby="modal-title"
			aria-modal="true"
			tabIndex={-1}
		>
			<div className="modal-container">
				{/* Modal header with optional title */}
				<div className="modal-header">
					<h2 id="modal-title" className="modal-title">
						{title}
					</h2>
				</div>
				{/* Custom content or default message */}
				{children ? (
					<div className="modal-content">{children}</div>
				) : (
					<p className="modal-content">{message}</p>
				)}
				{/* Action buttons using ActionBase */}
				<div className="modal-actions">
					<ActionBase
						as="button"
						onClick={onCancel}
						variant="secondary"
						className="modal-button cancel-button"
						color="neutral"
					>
						{cancelButtonText}
					</ActionBase>
					<ActionBase
						as="button"
						onClick={onConfirm}
						variant="primary"
						className="modal-button confirm-button"
						color="primary"
					>
						{confirmButtonText}
					</ActionBase>
				</div>
			</div>
		</div>
	);
};

export default ConfirmModal;
