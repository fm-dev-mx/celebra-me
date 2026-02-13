import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * App Logo icon.
 * Source: AppIcon.astro (Logic extracted)
 */
export const AppLogoIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<div className={`universal-icon--fallback ${className}`} data-size={size}>
		C
	</div>
);

export default AppLogoIcon;
