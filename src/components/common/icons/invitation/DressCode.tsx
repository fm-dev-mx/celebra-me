import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Tuxedo icon for formal dress code indications.
 */
export const DressCodeIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M7 3h10l2 18H5L7 3Z" />
		<path d="M9 3l3 6" />
		<path d="M15 3l-3 6" />
		<path d="M12 9v12" />
		<path d="M10 11l2-2 2 2" />
		<path d="M10 14h4" />
		<path d="M10 17h4" />
	</svg>
);

export default DressCodeIcon;
