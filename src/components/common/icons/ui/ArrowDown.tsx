import type { IconProps } from '@/components/common/icons/types/IconProps';

export const ArrowDownIcon = ({ className, size = 24 }: IconProps) => (
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
		<path d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
	</svg>
);
