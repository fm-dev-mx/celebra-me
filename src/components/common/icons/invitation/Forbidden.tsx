import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Forbidden icon (e.g., no children, no cellphones).
 * Source: ForbiddenIcon.astro
 */
export const ForbiddenIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<circle cx="12" cy="12" r="10" />
		<path d="m4.93 4.93 14.14 14.14" />
	</svg>
);

export default ForbiddenIcon;
