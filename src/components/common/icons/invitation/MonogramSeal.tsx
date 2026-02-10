import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Abstract Monogram icon for generic or minimalist invitations.
 * Source: SealIcons.tsx
 */
export const MonogramSealIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="currentColor"
		className={className}
		aria-hidden="true"
		role="img"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity="0.3" />
		<path d="M12,6a6,6,0,1,0,6,6A6,6,0,0,0,12,6Zm0,10a4,4,0,1,1,4-4A4,4,0,0,1,12,16Z" />
	</svg>
);

export default MonogramSealIcon;
