import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Church icon for religious ceremonies.
 * Source: TimelineList.tsx
 */
export const ChurchIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M12 22v-9" />
		<path d="M18 22V10l-6-7-6 7v12" />
		<path d="M12 7v4" />
		<path d="M10 9h4" />
	</svg>
);

export default ChurchIcon;
