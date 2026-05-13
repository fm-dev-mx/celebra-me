import type { IconProps } from '@/components/common/icons/types/IconProps';

export const ArrowRightIcon = ({ className, size = 24 }: IconProps) => (
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
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
	</svg>
);
