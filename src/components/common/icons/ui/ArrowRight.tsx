import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Arrow Right icon.
 * Source: AppIcon.astro
 */
export const ArrowRightIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
	</svg>
);

export default ArrowRightIcon;
