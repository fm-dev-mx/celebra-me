import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Party / Celebration icon.
 * Source: TimelineList.tsx
 */
export const PartyIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M2 13a2 2 0 1 0 0 4h20a2 2 0 1 0 0-4h-2a2 2 0 1 0 0-4H4a2 2 0 1 0 0 4H2Z" />
		<path d="M12 13v9" />
		<path d="M12 2v2" />
		<path d="m4.93 4.93 1.41 1.41" />
		<path d="M2 12h2" />
		<path d="M20 12h2" />
		<path d="m19.07 4.93-1.41 1.41" />
	</svg>
);

export default PartyIcon;
