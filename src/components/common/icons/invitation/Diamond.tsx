import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Diamond icon for luxury/formal events.
 * Source: AppIcon.astro
 */
export const DiamondIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
		<path d="M2 9h20M12 21 6 9M12 21l6-12" />
	</svg>
);

export default DiamondIcon;
