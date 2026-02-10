import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Cash / Envelope rain icon.
 * Source: Gifts.astro
 */
export const CashIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M19 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
		<path d="M12 12c-2 0-3-1-3-3s1-3 3-3 3 1 3 3-1 3-3 3Z" />
		<path d="M3 7l9 6 9-6" />
	</svg>
);

export default CashIcon;
