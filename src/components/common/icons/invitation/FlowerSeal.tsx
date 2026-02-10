import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Decorative Flower icon for romantic or nature-inspired themes.
 * Source: SealIcons.tsx
 */
export const FlowerSealIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<circle cx="12" cy="12" r="3" />
		<ellipse cx="12" cy="6" rx="2" ry="3" />
		<ellipse cx="12" cy="18" rx="2" ry="3" />
		<ellipse cx="6" cy="12" rx="3" ry="2" />
		<ellipse cx="18" cy="12" rx="3" ry="2" />
		<ellipse cx="7.5" cy="7.5" rx="2" ry="2.5" transform="rotate(-45 7.5 7.5)" />
		<ellipse cx="16.5" cy="7.5" rx="2" ry="2.5" transform="rotate(45 16.5 7.5)" />
		<ellipse cx="7.5" cy="16.5" rx="2" ry="2.5" transform="rotate(45 7.5 16.5)" />
		<ellipse cx="16.5" cy="16.5" rx="2" ry="2.5" transform="rotate(-45 16.5 16.5)" />
	</svg>
);

export default FlowerSealIcon;
