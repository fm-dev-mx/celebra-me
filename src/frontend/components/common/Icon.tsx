// src/frontend/components/common/Icon.tsx
import React from 'react';
import type { IconNames } from '@/core/types/ui/iconNames.type';
import * as Icons from '@components/icons'; // Import all icons from icons directory

// Define props interface, extending SVG attributes for more flexibility
interface IconProps extends React.SVGProps<SVGSVGElement> {
	icon: IconNames; // Defines the type of icon to render
	size?: string; // Optional size control, e.g., Tailwind classes like "w-6 h-6"
	color?: string; // Main icon color, defaults to 'currentColor'
	primaryColor?: string; // Optional primary color for dual-tone icons
	secondaryColor?: string; // Optional secondary color for dual-tone icons
}

// Map icon names to their respective components for easy access
const iconComponents: Record<IconNames, React.FC<React.SVGProps<SVGSVGElement>>> = Icons;

// Functional component for rendering icons
const Icon: React.FC<IconProps> = ({
	icon,
	size = 'w-6 h-6', // Default size using Tailwind classes
	color = 'currentColor',
	className,
	...rest
}) => {
	// Get the correct icon component based on provided name
	const IconComponent = iconComponents[icon];

	// Combine classes for the icon
	const iconClasses = `${size} ${className || ''}`.trim();

	// Filter custom props to avoid passing them to DOM elements
	const svgProps = { className: iconClasses, fill: color, ...rest };

	// Render the icon component with necessary props
	return IconComponent ? (
		<IconComponent
			{...svgProps}
			// Pass primaryColor and secondaryColor as inline styles or internal props to IconComponent if needed
		/>
	) : (
		<span className="text-red-500" title={`Icon not found: ${icon}`}>
			⚠️
		</span>
	);
};

export default Icon;
