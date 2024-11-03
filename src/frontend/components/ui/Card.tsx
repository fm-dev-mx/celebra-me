import React, { useEffect } from "react";

// Utility functions for handling interactivity
import { initializeCardHoverEffects } from "@/frontend/effects/CardHoverEffects";
import { initializeCardIntersectionObserver } from "@/frontend/effects/CardIntersectionObserver";

// Interface defining the props accepted by the Card component
interface CardProps {
	href?: string; // Optional link to wrap the card in
	bgColor?: string; // Background color of the card
	borderWidth?: string; // Width of the card's border
	borderColor?: string; // Color of the card's border
	textColor?: string; // Text color inside the card
	rounded?: string; // Border radius for the card corners
	boxShadow?: string; // Shadow effect for the card
	padding?: string; // Padding inside the card
	width?: string; // Width of the card
	hover?: string; // Hover effect classes
	extraClass?: string; // Any additional classes for customization
	transition?: string; // Transition effect for the card
	minWidth?: string; // Minimum width for the card
	maxWidth?: string; // Maximum width for the card
	minHeight?: string; // Minimum height for the card
	opacity?: string; // Opacity level for the card
	children: React.ReactNode; // Content to be rendered inside the card
}

// Card component definition with default values for props
const Card: React.FC<CardProps> = ({
	href,
	bgColor = "bg-white",
	borderWidth = "border-2",
	borderColor = "border-primary",
	textColor = "text-primary-light",
	rounded = "rounded-lg",
	boxShadow = "shadow-2xl",
	padding = "p-5",
	width = "",
	hover = "hover:brightness-105",
	extraClass = "",
	transition = "transition-all duration-300",
	minWidth = "min-w-56",
	maxWidth = "max-w-56",
	minHeight = "min-h-60",
	opacity = "opacity-100",
	children,
}) => {
	// Handle hover and intersection effects based on device type
	useEffect(() => {
		const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

		// Initialize relevant effects based on device type
		isTouchDevice ? initializeCardIntersectionObserver() : initializeCardHoverEffects();
	}, []); // Runs only once when the component mounts

	// Combine all provided classes into a single string for the card element
	const classList = [
		bgColor,
		borderWidth,
		borderColor,
		textColor,
		rounded,
		boxShadow,
		padding,
		width,
		hover,
		extraClass,
		transition,
		minWidth,
		maxWidth,
		minHeight,
		opacity,
	].join(" ");

	// Renders the content of the card
	const cardContent = (
		<div className={classList}>
			<div className="flex flex-col content-center items-center text-center">{children}</div>
		</div>
	);

	// Wrap the card in a link if href is provided
	return href ? (
		<a href={href} className="block w-full h-full no-underline">
			{cardContent}
		</a>
	) : (
		cardContent
	);
};

export default Card;
