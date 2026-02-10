import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Photo / Camera icon.
 * Source: TimelineList.tsx
 */
export const PhotoIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<rect x="3" y="4" width="18" height="15" rx="2" />
		<circle cx="12" cy="11.5" r="2.5" />
		<path d="m3 19 4.5-5 4 4 4.5-6.5 5 7.5" />
	</svg>
);

export default PhotoIcon;
