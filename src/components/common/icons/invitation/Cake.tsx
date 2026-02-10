import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Cake / Dessert icon.
 * Source: TimelineList.tsx
 */
export const CakeIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
		<path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
		<path d="M2 21h20" />
		<path d="M7 8v3" />
		<path d="M12 8v3" />
		<path d="M17 8v3" />
		<path d="M7 4h.01" />
		<path d="M12 4h.01" />
		<path d="M17 4h.01" />
	</svg>
);

export default CakeIcon;
