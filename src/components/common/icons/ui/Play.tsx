import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Play icon for media controls.
 * Source: MusicPlayer.tsx
 */
export const PlayIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path
			fillRule="evenodd"
			d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
			clipRule="evenodd"
		/>
	</svg>
);

export default PlayIcon;
