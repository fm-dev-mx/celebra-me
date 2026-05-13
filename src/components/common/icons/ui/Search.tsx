import type { IconProps } from '@/components/common/icons/types/IconProps';

export const SearchIcon = ({ className, size = 24 }: IconProps) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
	>
		<circle cx="11" cy="11" r="6.5" />
		<path d="M16 16l5 5" />
	</svg>
);
