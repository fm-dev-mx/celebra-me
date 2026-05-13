import type { IconProps } from '@/components/common/icons/types/IconProps';

export const CrownIcon = ({ className, size = 24 }: IconProps) => (
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
		<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
	</svg>
);
