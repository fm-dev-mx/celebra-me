import type { IconProps } from '@/components/common/icons/types/IconProps';

export const ShellSealIcon = ({ className, size = 24 }: IconProps) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.1"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M12 18.6 5.3 11c-.7-.8-.6-2.1.2-2.8C7.2 5.5 9.5 4.3 12 4.3s4.8 1.2 6.5 3.9c.8.7.9 2 .2 2.8L12 18.6Z"
			fill="currentColor"
			fillOpacity="0.16"
		/>
		<path d="M12 18.6 7.8 6.2M12 18.6 10 4.9M12 18.6V4.3M12 18.6l2-13.7M12 18.6l4.2-12.4" />
		<path d="M10.1 18.6h3.8l-.8 1.4h-2.2l-.8-1.4Z" />
	</svg>
);
