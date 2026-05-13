import type { IconProps } from '@/components/common/icons/types/IconProps';

export const ChevronDownIcon = ({ className, size = 24 }: IconProps) => (
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
		<polyline points="6 9 12 15 18 9"></polyline>
	</svg>
);
