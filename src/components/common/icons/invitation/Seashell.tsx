import type { IconProps } from '@/components/common/icons/types/IconProps';

export const SeashellIcon = ({ className, size = 24 }: IconProps) => (
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
		<path d="M12 19.5 4.4 10.9c-.8-.9-.7-2.4.2-3.2C6.6 4.6 9.2 3.2 12 3.2s5.4 1.4 7.4 4.5c.9.8 1 2.3.2 3.2L12 19.5Z" />
		<path d="M12 19.5 7.2 5.4M12 19.5 9.5 3.9M12 19.5V3.2M12 19.5l2.5-15.6M12 19.5l4.8-14.1" />
		<path d="M9.8 19.5h4.4l-.9 1.6h-2.6l-.9-1.6Z" />
	</svg>
);
