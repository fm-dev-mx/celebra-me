import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Gift bag / store icon.
 * Source: Gifts.astro
 */
export const GiftIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		role="img"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
		<path d="M3 6h18" />
		<path d="M16 10a4 4 0 0 1-8 0" />
	</svg>
);

export default GiftIcon;
