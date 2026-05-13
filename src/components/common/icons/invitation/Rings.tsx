import type { IconProps } from '@/components/common/icons/types/IconProps';

export const RingsIcon = ({ className, size = 24 }: IconProps) => (
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
		<path d="M8 11a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm8 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
	</svg>
);
