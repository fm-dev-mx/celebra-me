import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * PayPal icon.
 * Source: Gifts.astro
 */
export const PayPalIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M7 15 5.8 5.9A1.1 1.1 0 0 1 6.9 4.7h7a4.9 4.9 0 0 1 0 9.8H10l-1.2 5.1a1.1 1.1 0 0 1-1.1.9H3.1a1.1 1.1 0 0 1-1-1.3l.8-3.1Z" />
		<path d="M16 17c1.3 0 2.4-1.1 2.2-2.5l-.8-3.5" />
	</svg>
);

export default PayPalIcon;
