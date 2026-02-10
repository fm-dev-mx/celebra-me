import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Credit card / Bank icon.
 * Source: Gifts.astro
 */
export const BankCardIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<rect width="20" height="14" x="2" y="5" rx="2" />
		<line x1="2" x2="22" y1="10" y2="10" />
	</svg>
);

export default BankCardIcon;
