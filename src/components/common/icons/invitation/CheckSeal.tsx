import type { IconProps } from '@/components/common/icons/types/IconProps';

export const CheckSealIcon = ({ className, size = 64 }: IconProps) => (
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
		<circle cx="12" cy="12" r="10" />
		<path d="m8 12 2.5 2.5 5.5-5.5" />
	</svg>
);
