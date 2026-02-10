import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Arrow Down icon.
 * Source: AppIcon.astro
 */
export const ArrowDownIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
	</svg>
);

export default ArrowDownIcon;
