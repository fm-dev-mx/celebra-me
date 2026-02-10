import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Message icon for contact/RSVP.
 * Source: AppIcon.astro
 */
export const MessageIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
	</svg>
);

export default MessageIcon;
