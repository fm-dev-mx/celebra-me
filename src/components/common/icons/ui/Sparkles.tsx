import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Sparkles icon.
 * Source: AppIcon.astro
 */
export const SparklesIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
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
		<path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09l2.846.813-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.25 10.5l-.457-1.6a2.25 2.25 0 00-1.443-1.443L14.75 7l1.6-.457a2.25 2.25 0 001.443-1.443l.457-1.6.457 1.6a2.25 2.25 0 001.443 1.443l1.6.457-1.6.457a2.25 2.25 0 00-1.443 1.443l-.457 1.6z" />
	</svg>
);

export default SparklesIcon;
