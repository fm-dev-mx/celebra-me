import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Premium Boot icon for western-themed invitations.
 * Source: SealIcons.tsx
 */
export const BootSealIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M19.5,21H4.5a1,1,0,0,1-1-1V18a3,3,0,0,1,3-3h3.5v-2.5a2,2,0,0,1,2-2h1V7a3,3,0,0,1,3-3h.5a2,2,0,0,1,2,2V20A1,1,0,0,1,19.5,21ZM5.5,19H17.5V6a.5.5,0,0,0-.5-.5h-.5a1.5,1.5,0,0,0-1.5,1.5v4a1,1,0,0,1-1,1h-2v2.5a1,1,0,0,1-1,1h-4a1.5,1.5,0,0,0-1.5,1.5Z" />
		<ellipse cx="16.5" cy="18" rx="1" ry="0.5" opacity="0.6" />
		<line x1="17.5" y1="18" x2="19" y2="18.5" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
	</svg>
);

export default BootSealIcon;
