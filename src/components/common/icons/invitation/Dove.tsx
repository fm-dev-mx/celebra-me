import type { IconProps } from '@/components/common/icons/types/IconProps';

export const DoveIcon = ({ className, size = 24 }: IconProps) => (
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
		<path d="M12 21.5c-3.1 0-6-2.5-6-6 0-1.8.8-3.5 2-4.5-1.2-1-2-2.7-2-4.5 0-3.5 2.9-6 6-6s6 2.5 6 6c0 1.8-.8 3.5-2 4.5 1.2 1 2 2.7 2 4.5 0 3.5-2.9 6-6 6Z" />
	</svg>
);
