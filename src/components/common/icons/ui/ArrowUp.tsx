import type { IconProps } from '@/components/common/icons/types/IconProps';

export const ArrowUpIcon = ({ className, size = 24 }: IconProps) => (
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
		<path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
	</svg>
);
