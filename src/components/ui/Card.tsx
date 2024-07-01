import React, { useEffect, useRef } from "react";

// Import the hover and intersection observer effects
import { initializeCardHoverEffects } from "@utilities/CardHoverEffects";
import { initializeCardIntersectionObserver } from "@utilities/CardIntersectionObserver";

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
	children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
	href = "#",
	bgColor = "bg-white",
	borderWidth = "border-2",
	borderColor = "border-primary",
	textColor = "text-primary-light",
	rounded = "rounded-lg",
	boxShadow = "shadow-2xl",
	padding = "p-5",
	width = "w-full",
	hover = "hover:brightness-105",
	extraClass = "",
	transition = "transition-all duration-300",
	children,
}) => {
	const cardRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
		console.log("isTouchDevice: " + isTouchDevice);
		if (isTouchDevice) {
			initializeCardIntersectionObserver();
		} else {
			initializeCardHoverEffects();
		}
	}, []);

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
	].join(" ");

	return (
		<a href={href} className="block w-full h-full no-underline">
			<div ref={cardRef} className={classList}>
				<div className="flex flex-col content-center items-center text-center">
					{children}
				</div>
			</div>
		</a>
	);
};

export default Card;
