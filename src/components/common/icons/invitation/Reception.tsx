import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Reception / Venue icon.
 * Source: TimelineList.tsx
 */
export const ReceptionIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
		<path d="M11 3 8 9l3 12 3-12-3-6Z" />
		<path d="M2 9h20" />
	</svg>
);

export default ReceptionIcon;
