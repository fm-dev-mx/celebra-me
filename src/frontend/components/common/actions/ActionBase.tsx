// src/components/common/actions/ActionBase.tsx

import React from "react";

// Define the base variants for styling purposes
export type BaseActionVariants = "primary" | "secondary" | "text" | "scroll" | "large" | "whatsapp";

// Define external and icon variants based on the base variants
export type ExternalVariants = `external-${BaseActionVariants}`;
export type IconVariants = `icon-${BaseActionVariants}`;

// Combine all possible action variants
export type ActionVariants = BaseActionVariants | ExternalVariants | IconVariants;

// Define possible color options for the action
export type ActionColors = "primary" | "secondary" | "accent" | "neutral";

// Define the types of elements the component can render
type ElementType = keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>;

// Define props for ActionBase using generics for flexibility
type ActionBaseProps<T extends ElementType> = Omit<
	React.ComponentPropsWithRef<T>,
	"as" | "color" | "variant"
> & {
	variant?: ActionVariants;
	href?: string;
	color?: ActionColors;
	as?: T;
	target?: string;
	className?: string;
	children?: React.ReactNode;
};

/**
 * ActionBase component provides a flexible structure for different types of actions.
 * It applies consistent styling and allows for customization.
 *
 * @template T - The type of element to render (e.g., 'a', 'button')
 * @param {ActionBaseProps<T>} props - The props for the component
 * @returns {JSX.Element} The rendered component
 */
const ActionBase = <T extends ElementType = "button">({
	as,
	variant = "primary",
	href,
	color = "primary",
	target,
	rel,
	className = "",
	children,
	...rest
}: ActionBaseProps<T>): JSX.Element => {
	// Determine the element to render, defaulting to 'button'
	const Component = as || "button";

	// Generate class names based on variant and color
	const variantClass = `action-${variant}`;
	const colorClass = `color-${color}`;

	// Combine all class names into one string
	const combinedClasses = `action-base ${variantClass} ${colorClass} ${className}`.trim();

	// Render the component with all props spread
	return (
		<div className="action-base-wrapper">
			<Component
				className={combinedClasses}
				href={as === "a" ? href : undefined} // Ensure href is only applied to <a>
				target={as === "a" && target ? target : undefined} // Ensure target is only applied to <a>
				rel={as === "a" && target === "_blank" ? rel : undefined} // Add rel for security
				{...rest}
			>
				{children}
			</Component>
		</div>
	);
};

export default ActionBase;
