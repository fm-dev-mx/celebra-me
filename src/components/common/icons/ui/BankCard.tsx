import type { IconProps } from '@/components/common/icons/types/IconProps';

export const BankCardIcon = ({ className, size = 24 }: IconProps) => (
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
		<rect width="20" height="14" x="2" y="5" rx="2" />
		<line x1="2" x2="22" y1="10" y2="10" />
	</svg>
);
