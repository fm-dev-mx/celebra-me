import type { IconProps } from '@/components/common/icons/types/IconProps';

export const ChurchIcon = ({ className, size = 24 }: IconProps) => (
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
		<path d="M12 22v-9" />
		<path d="M18 22V10l-6-7-6 7v12" />
		<path d="M12 7v4" />
		<path d="M10 9h4" />
	</svg>
);
