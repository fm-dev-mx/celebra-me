import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Rings icon for weddings.
 * Source: AppIcon.astro
 */
export const RingsIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		role="img"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M8 11a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm8 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
	</svg>
);

export default RingsIcon;
