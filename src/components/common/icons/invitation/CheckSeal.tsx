import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

export const CheckSealIcon: React.FC<IconProps> = ({ className, size = 64 }) => (
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
		<circle cx="12" cy="12" r="10" />
		<path d="m8 12 2.5 2.5 5.5-5.5" />
	</svg>
);

export default CheckSealIcon;
