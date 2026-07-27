import { useId, type FC } from 'react';
import type { IconProps } from '@/components/common/icons/types/IconProps';

interface WaxMonogramSealProps extends IconProps {
	initials?: string;
}

/** Font size in viewBox units (120). Tuned for ~56–84px rendered seals. */
function resolveInitialsFontSize(initials: string): number {
	const length = initials.trim().length;
	if (length <= 2) return 48;
	if (length === 3) return 38;
	return 30;
}

/**
 * Embossed wax-seal monogram for envelope reveal.
 * Parametric initials; rose-gold defaults overridable via CSS vars:
 * --wax-seal-highlight, --wax-seal-mid, --wax-seal-deep, --wax-seal-letter,
 * --wax-seal-shadow, --wax-seal-sheen, --wax-seal-emboss-shadow,
 * --wax-seal-font-family.
 *
 * Typography defaults to a refined serif/label face (not --font-calligraphy)
 * so seal initials do not twin the envelope name script.
 */
export const WaxMonogramSealIcon: FC<WaxMonogramSealProps> = ({
	className,
	size = 24,
	initials,
}) => {
	const rawId = useId().replace(/:/g, '');
	const gradId = `wax-grad-${rawId}`;
	const rimGradId = `wax-rim-${rawId}`;
	const embossId = `wax-emboss-${rawId}`;
	const letterId = `wax-letter-${rawId}`;
	const softShadowId = `wax-shadow-${rawId}`;
	const label = initials?.trim() || undefined;

	return (
		<svg
			viewBox="0 0 120 120"
			width={size}
			height={size}
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			role={label ? 'img' : 'presentation'}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<defs>
				<radialGradient id={gradId} cx="34%" cy="30%" r="72%">
					<stop offset="0%" stopColor="var(--wax-seal-highlight, #f7ddd4)" />
					<stop offset="42%" stopColor="var(--wax-seal-mid, #e8b4a8)" />
					<stop offset="100%" stopColor="var(--wax-seal-deep, #c4897c)" />
				</radialGradient>
				<linearGradient id={rimGradId} x1="20%" y1="10%" x2="85%" y2="95%">
					<stop offset="0%" stopColor="var(--wax-seal-highlight, #f7ddd4)" />
					<stop offset="55%" stopColor="var(--wax-seal-mid, #e8b4a8)" />
					<stop offset="100%" stopColor="var(--wax-seal-deep, #b8796c)" />
				</linearGradient>
				<filter
					id={softShadowId}
					x="-20%"
					y="-20%"
					width="140%"
					height="140%"
					colorInterpolationFilters="sRGB"
				>
					<feDropShadow
						dx="0"
						dy="3"
						stdDeviation="2.4"
						floodColor="var(--wax-seal-shadow, #4a2a24)"
						floodOpacity="0.45"
					/>
				</filter>
				<filter
					id={embossId}
					x="-30%"
					y="-30%"
					width="160%"
					height="160%"
					colorInterpolationFilters="sRGB"
				>
					<feGaussianBlur in="SourceAlpha" stdDeviation="0.7" result="blur" />
					<feOffset dx="0.6" dy="0.9" result="offsetBlur" />
					<feFlood
						floodColor="var(--wax-seal-emboss-shadow, #5c322c)"
						floodOpacity="0.45"
						result="shadowColor"
					/>
					<feComposite in="shadowColor" in2="offsetBlur" operator="in" result="shadow" />
					<feSpecularLighting
						in="blur"
						surfaceScale="2.4"
						specularConstant="0.85"
						specularExponent="18"
						lightingColor="var(--wax-seal-sheen, #fff8f4)"
						result="spec"
					>
						<fePointLight x="-24" y="-36" z="48" />
					</feSpecularLighting>
					<feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
					<feComposite
						in="SourceGraphic"
						in2="shadow"
						operator="over"
						result="withShadow"
					/>
					<feComposite
						in="specIn"
						in2="withShadow"
						operator="arithmetic"
						k1="0"
						k2="0.55"
						k3="1"
						k4="0"
					/>
				</filter>
				{/* Soft lift for initials — contrast via shadow only (no text stroke). */}
				<filter
					id={letterId}
					x="-20%"
					y="-20%"
					width="140%"
					height="140%"
					colorInterpolationFilters="sRGB"
				>
					<feDropShadow
						dx="0"
						dy="0.9"
						stdDeviation="0.5"
						floodColor="var(--wax-seal-shadow, #4a2a24)"
						floodOpacity="0.4"
					/>
					<feDropShadow
						dx="0"
						dy="-0.35"
						stdDeviation="0.3"
						floodColor="var(--wax-seal-sheen, #fff8f4)"
						floodOpacity="0.28"
					/>
				</filter>
			</defs>

			{/* Melted wax body */}
			<g filter={`url(#${softShadowId})`}>
				<path
					d="M60.2 6.4c8.6-1.2 17.8 0.6 25.4 4.8 7.8 4.3 15.2 10.6 19.2 18.6 4.2 8.4 5.8 18.2 4.1 27.4-1.6 8.8-6.4 17-13.2 23.2-6.6 6-15.2 10.8-24.2 12.4-9.2 1.6-19 0.4-27.4-3.8-8.2-4.1-15.4-11-19.6-19.2C20.2 61.2 18 51.4 19.4 42c1.3-8.8 6.2-17 13.2-22.8C40 13.2 49.2 7.8 60.2 6.4Z"
					fill={`url(#${gradId})`}
				/>
				{/* Irregular outer rim highlights */}
				<path
					d="M60.2 6.4c8.6-1.2 17.8 0.6 25.4 4.8 7.8 4.3 15.2 10.6 19.2 18.6 1.8 3.6 3.1 7.4 3.9 11.4-2.8-6.2-7.8-11.4-13.8-15.2-8.4-5.4-18.4-7.4-28.2-6.2-7.6 0.9-14.8 3.8-20.8 8.2 4.6-6.2 11.8-10.8 19.8-13.2 4.7-1.4 9.6-2.2 14.5-2.4Z"
					fill={`url(#${rimGradId})`}
					opacity="0.55"
				/>
			</g>

			{/* Recessed basin — slightly lighter so letters read on top */}
			<circle cx="60" cy="60" r="38" fill="var(--wax-seal-deep, #c4897c)" opacity="0.18" />
			<circle
				cx="60"
				cy="60"
				r="38"
				fill="none"
				stroke="var(--wax-seal-highlight, #f7ddd4)"
				strokeWidth="1.1"
				opacity="0.35"
			/>

			{/* Inner embossed rings */}
			<g filter={`url(#${embossId})`} opacity="0.95">
				<circle
					cx="60"
					cy="60"
					r="33.5"
					fill="none"
					stroke="var(--wax-seal-highlight, #f7ddd4)"
					strokeWidth="1.35"
				/>
				<circle
					cx="60"
					cy="60"
					r="29.5"
					fill="none"
					stroke="var(--wax-seal-mid, #e8b4a8)"
					strokeWidth="0.7"
					opacity="0.85"
				/>
			</g>

			{/* Soft top-left sheen on basin */}
			<ellipse
				cx="48"
				cy="46"
				rx="22"
				ry="16"
				fill="var(--wax-seal-sheen, #fff8f4)"
				opacity="0.12"
			/>

			{label ? (
				<text
					x="60"
					y="63"
					textAnchor="middle"
					dominantBaseline="middle"
					fontSize={resolveInitialsFontSize(label)}
					fontFamily="var(--wax-seal-font-family, var(--font-label, var(--font-display, Georgia, 'Times New Roman', serif)))"
					fontWeight="400"
					letterSpacing={label.length <= 2 ? '0.06em' : '0.03em'}
					fill="var(--wax-seal-letter, #5c322c)"
					filter={`url(#${letterId})`}
				>
					{label}
				</text>
			) : (
				<circle
					cx="60"
					cy="60"
					r="8"
					fill="none"
					stroke="var(--wax-seal-letter, #5c322c)"
					strokeWidth="1.2"
					opacity="0.55"
					filter={`url(#${letterId})`}
				/>
			)}
		</svg>
	);
};

export default WaxMonogramSealIcon;
