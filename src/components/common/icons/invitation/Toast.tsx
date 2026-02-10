import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Toast icon for event celebrations.
 * Source: ToastIcon.astro
 */
export const ToastIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		role="img"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M8 22h8" />
		<path d="M7 10h10" />
		<path d="M12 15v7" />
		<path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z" />
	</svg>
);

export default ToastIcon;
