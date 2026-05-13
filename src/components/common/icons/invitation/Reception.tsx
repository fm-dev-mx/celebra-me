import type { IconProps } from '@/components/common/icons/types/IconProps';

export const ReceptionIcon = ({ className, size = 24 }: IconProps) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
		<path d="M11 3 8 9l3 12 3-12-3-6Z" />
		<path d="M2 9h20" />
	</svg>
);
