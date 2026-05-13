import type { IconProps } from '@/components/common/icons/types/IconProps';

import type { IconProps } from '@/components/common/icons/types/IconProps';

interface IconProps {
	className?: string;
	size?: number | string;
	initials?: string;
}

export const MonogramSealIcon: React.FC<IconProps> = ({ className, size = 24, initials }) => {
	if (initials) {
		return (
			<svg
				viewBox="0 0 24 24"
				width={size}
				height={size}
				fill="currentColor"
				className={className}
				xmlns="http://www.w3.org/2000/svg"
				aria-label={initials}
			>
				<circle
					cx="12"
					cy="12"
					r="11"
					fill="none"
					stroke="currentColor"
					strokeWidth="0.75"
					opacity="0.4"
				/>
				<circle
					cx="12"
					cy="12"
					r="9.5"
					fill="none"
					stroke="currentColor"
					strokeWidth="0.3"
					opacity="0.25"
				/>
				<text
					x="12"
					y="12"
					textAnchor="middle"
					dominantBaseline="central"
					fontSize="var(--monogram-font-size, 7)"
					fontWeight="500"
					letterSpacing="var(--monogram-letter-spacing, 0.5)"
					fill="currentColor"
					opacity="0.85"
					fontFamily="var(--monogram-font-family, Georgia, serif)"
				>
					{initials}
				</text>
			</svg>
		);
	}

	return (
		<svg
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="currentColor"
			className={className}
			aria-hidden="true"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M12,2A10,10,0,1,0,22,12,10,10,0,0,0,12,2Zm0,18a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
				opacity="0.3"
			/>
			<path d="M12,6a6,6,0,1,0,6,6A6,6,0,0,0,12,6Zm0,10a4,4,0,1,1,4-4A4,4,0,0,1,12,16Z" />
		</svg>
	);
};

export default MonogramSealIcon;
