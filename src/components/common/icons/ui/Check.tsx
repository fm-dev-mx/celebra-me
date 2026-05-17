import React from 'react';

export const CheckIcon: React.FC<{ size?: number; className?: string }> = ({
	size = 24,
	className,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
	>
		<polyline points="20 6 9 17 4 12" />
	</svg>
);
