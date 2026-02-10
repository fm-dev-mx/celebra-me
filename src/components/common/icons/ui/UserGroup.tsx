import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * User group icon for attendance/RSVP.
 * Source: AppIcon.astro
 */
export const UserGroupIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		role="img"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M4.5 14.2c1.8-1.3 3.6-2 5.6-2h1.3c1.6 0 2.8 1 2.8 2.2 0 1.3-1.2 2.2-2.8 2.2H9.9" />
		<path d="M4.5 14.2v4.3c0 .9.7 1.5 1.6 1.5h6.9c1.2 0 2.2-.3 3.1-.9l3.1-2.1c.8-.5 1-1.5.4-2.1-.5-.6-1.4-.7-2.2-.2l-2.1 1.2" />
		<path d="M16.6 6.7c-.9 0-1.6.5-2 1.1-.4-.6-1.1-1.1-2-1.1-1.2 0-2.2 1-2.2 2.3 0 2 4.2 4.3 4.2 4.3S18.8 11 18.8 9c0-1.3-1-2.3-2.2-2.3Z" />
	</svg>
);

export default UserGroupIcon;
