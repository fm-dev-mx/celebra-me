// ActionExternalLink.tsx
import React, { useState, useCallback } from "react";
import ActionBase from "./ActionBase"; // Import the base component for actions.
import ConfirmModal from "@/frontend/components/ui/ConfirmModal"; // Import the confirmation modal component.
import type { HTMLAttributes } from "react";
import type {
	ActionVariants,
	ActionColors,
	BaseActionVariants,
	ExternalVariants,
} from "./ActionBase";
import type { MouseEvent as ReactMouseEvent } from "react";

// Define the props interface for the ActionExternalLink component.
interface ActionLinkProps extends HTMLAttributes<HTMLAnchorElement> {
	href: string; // The link destination.
	confirmMessage?: string; // Optional message displayed in the confirmation modal.
	confirmTitle?: string; // Optional title for the confirmation modal.
	confirmButtonText?: string; // Optional text for the confirmation button.
	cancelButtonText?: string; // Optional text for the cancel button.
	variant?: BaseActionVariants; // Base variant styling options without prefixes.
	externalVariant?: ExternalVariants; // External-prefixed variants, handled separately to avoid duplicates.
	color?: ActionColors; // Color options inherited from ActionBase for styling.
	className?: string; // Allows for additional CSS classes.
}

const ActionExternalLink: React.FC<ActionLinkProps> = ({
	href,
	variant = "primary", // Default variant is 'primary' if none is provided.
	externalVariant,
	color = "primary", // Default color is 'primary' if none is specified.
	confirmMessage = "Are you sure you want to proceed?", // Default confirmation message.
	confirmTitle = "Confirmation", // Default title for the confirmation modal.
	confirmButtonText = "Confirm", // Default text for the confirmation button.
	cancelButtonText = "Cancel", // Default text for the cancel button.
	className,
	children,
	...rest // Spread any additional props to the underlying component.
}) => {
	// State to manage the visibility of the confirmation modal.
	const [isModalVisible, setIsModalVisible] = useState(false);

	// Compute the correct variant, avoiding double 'external-' prefix by defaulting to externalVariant if provided.
	const computedVariant: ActionVariants =
		externalVariant ?? (`external-${variant}` as ActionVariants);

	// Handle click event to show the confirmation modal instead of directly navigating.
	const handleClick = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
		event.preventDefault(); // Prevent the default navigation behavior.
		setIsModalVisible(true); // Show the confirmation modal.
	}, []);

	// Handle cancel action to hide the confirmation modal without proceeding.
	const handleCancel = useCallback(() => {
		setIsModalVisible(false); // Hide the modal without taking action.
	}, []);

	// Handle confirm action to proceed with the external link navigation.
	const handleConfirm = useCallback(() => {
		setIsModalVisible(false); // Hide the modal.
		window.open(href, "_blank"); // Open the link in a new tab.
	}, [href]);

	return (
		<>
			{/* Main clickable element rendering as a link */}
			<ActionBase
				as="a" // Specify the element type as an anchor link.
				href={href} // Pass the href to the ActionBase component.
				variant={computedVariant} // Use the computed variant to ensure valid styling.
				color={color} // Set the color for the component based on props.
				className={className} // Apply additional classes as needed.
				onClick={handleClick} // Attach the click handler to trigger the confirmation modal.
				{...rest} // Spread any other props to maintain flexibility.
			>
				{children}
			</ActionBase>
			{/* Render the ConfirmModal when the state indicates it should be visible */}
			{isModalVisible && (
				<ConfirmModal
					show={true} // Control the visibility based on component state.
					title={confirmTitle} // Display the modal's title.
					message={confirmMessage} // Display the confirmation message.
					confirmButtonText={confirmButtonText} // Text for the confirm action button.
					cancelButtonText={cancelButtonText} // Text for the cancel action button.
					onConfirm={handleConfirm} // Handler to execute upon confirmation.
					onCancel={handleCancel} // Handler to execute if the action is canceled.
				/>
			)}
		</>
	);
};

export default ActionExternalLink;
