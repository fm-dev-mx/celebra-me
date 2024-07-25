import React, { useEffect } from "react";

// Import utility functions for card interactivity
import { initializeCardHoverEffects } from "@utilities/CardHoverEffects";
import { initializeCardIntersectionObserver } from "@utilities/CardIntersectionObserver";

// Define the props interface for the Card component
interface CardProps {
	href?: string;
	bgColor?: string;
	borderWidth?: string;
	borderColor?: string;
	textColor?: string;
	rounded?: string;
	boxShadow?: string;
	padding?: string;
	width?: string;
	hover?: string;
	extraClass?: string;
	transition?: string;
	minWidth?: string;
	maxWidth?: string;
	minHeight?: string;
	opacity?: string;
	children: React.ReactNode;
}

// Card component definition with default prop values
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
	useEffect(() => {
		// Check if the device has touch capabilities
		const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
		console.log("isTouchDevice: " + isTouchDevice);

		// Initialize different effects based on device type
		if (isTouchDevice) {
			// For touch devices, use intersection observer for effects
			initializeCardIntersectionObserver();
		} else {
			// For non-touch devices, use hover effects
			initializeCardHoverEffects();
		}
	}, []); // Empty dependency array ensures this effect runs once on mount

	// Combine all CSS classes into a single string
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

	// Inner content of the card
	const cardContent = (
		<div className={classList}>
			{/* Inner container for centering content */}
			<div className="flex flex-col content-center items-center text-center">
				{children}
			</div>
		</div>
	);

	// Render the card component
	if (href) {
		return (
			<a href={href} className="block w-full h-full no-underline">
				{cardContent}
			</a>
		);
	} else {
		return cardContent;
	}
};

export default Card;
