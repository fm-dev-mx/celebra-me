import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Chevron down icon for accordions (FAQ).
 * Source: ReactIcons.tsx
 */
export const ChevronDownIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		role="img"
		xmlns="http://www.w3.org/2000/svg"
	>
		<polyline points="6 9 12 15 18 9"></polyline>
	</svg>
);

export default ChevronDownIcon;
