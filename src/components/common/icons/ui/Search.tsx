import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

export const SearchIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		role="img"
		xmlns="http://www.w3.org/2000/svg"
	>
		<circle cx="11" cy="11" r="6.5" />
		<path d="M16 16l5 5" />
	</svg>
);

export default SearchIcon;
