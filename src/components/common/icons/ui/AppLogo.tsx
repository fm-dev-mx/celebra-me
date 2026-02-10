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
	<div
		className={`border-2 border-current rounded-full flex items-center justify-center font-bold text-[10px] ${className}`}
		style={{ width: size, height: size }}
	>
		C
	</div>
);

export default AppLogoIcon;
