import { useId, type FC } from 'react';
import type { IconProps } from '@/components/common/icons/types/IconProps';

interface WaxMonogramSealProps extends IconProps {
	initials?: string;
}

/** Irregular melted-wax silhouette (viewBox 120). Shared by body, bead, and die rings. */
const WAX_BODY_D =
	'M60.2 6.4c8.6-1.2 17.8 0.6 25.4 4.8 7.8 4.3 15.2 10.6 19.2 18.6 4.2 8.4 5.8 18.2 4.1 27.4-1.6 8.8-6.4 17-13.2 23.2-6.6 6-15.2 10.8-24.2 12.4-9.2 1.6-19 0.4-27.4-3.8-8.2-4.1-15.4-11-19.6-19.2C20.2 61.2 18 51.4 19.4 42c1.3-8.8 6.2-17 13.2-22.8C40 13.2 49.2 7.8 60.2 6.4Z';

/** Main cuño — ~12% inset, lightly off-center so it never reads as a pasted circle. */
const DIE_MAIN_TRANSFORM = 'translate(60.35 60.5) scale(0.88) translate(-60.2 -60.2)';

/** Inner echo — ~20% inset; quiet heraldic second line around the monogram plate. */
const DIE_ECHO_TRANSFORM = 'translate(60.4 60.6) scale(0.8) translate(-60.2 -60.2)';

/** Bounding-box center of WAX_BODY_D; the silhouette is not centered on the viewBox. */
const BODY_CENTER = { x: 64.28, y: 49.76 };

/**
 * Because the silhouette is off-center, the monogram must follow the plate enclosed by
 * the echo ring instead of the 60/60 midpoint.
 */
const PLATE_CENTER = { x: 63.66, y: 52.25 };

/** Cap-height share of the em for the serif faces the seal resolves to. */
const CAP_HEIGHT_RATIO = 0.7;

/** A middot or dot reads as a separator, not a letter, so it carries less width weight. */
const SEPARATOR_WEIGHT = 0.5;

/**
 * Serif middots sit on the x-height center, roughly this far below the cap-height center
 * the surrounding capitals are aligned to. Lifting them keeps the separator on the die's
 * visual center line.
 */
const SEPARATOR_LIFT_EM = 0.074;

function isLetterOrDigit(char: string): boolean {
	return /[\p{L}\p{N}]/u.test(char);
}

function resolveTypeWeight(initials: string): number {
	return [...initials].reduce(
		(total, char) => total + (isLetterOrDigit(char) ? 1 : SEPARATOR_WEIGHT),
		0,
	);
}

interface MonogramRun {
	text: string;
	dy: number;
}

/** Splits initials into runs so separators can be raised without moving the capitals. */
function buildMonogramRuns(initials: string, lift: number): MonogramRun[] {
	const runs: MonogramRun[] = [];
	let offset = 0;

	for (const char of initials) {
		const target = isLetterOrDigit(char) ? 0 : -lift;
		const last = runs.at(-1);

		if (last && target === offset) {
			last.text += char;
			continue;
		}

		runs.push({ text: char, dy: target - offset });
		offset = target;
	}

	return runs;
}

/**
 * Font size in viewBox units (120). Sized against the ~72-unit plate so ink keeps a
 * margin from the echo ring at every supported length, worst case being wide capitals.
 */
function resolveInitialsFontSize(weight: number): number {
	if (weight <= 2) return 42;
	if (weight <= 2.5) return 34;
	if (weight <= 3) return 25;
	if (weight <= 3.5) return 22;
	if (weight <= 4) return 20;
	return 17;
}

/** A separator already spaces the glyphs, so extra tracking would only crowd the plate. */
function resolveLetterSpacingEm(initials: string): number {
	if ([...initials].some((char) => !isLetterOrDigit(char))) return 0.03;
	return initials.length <= 2 ? 0.06 : 0.04;
}

/**
 * Embossed wax-seal monogram for envelope reveal.
 *
 * Atelier lacre: melted silhouette, one pressed cuño with a quiet inner echo, and a
 * slightly recessed monogram plate. Light comes from the body gradient, the die shadow
 * emboss, and a short edge catch-light — never from drawn discs, rings, or ellipses.
 * The body gradient uses userSpaceOnUse so inset fills share one absolute ramp instead
 * of remapping into a visible lighter disc.
 *
 * Parametric initials; rose-gold defaults overridable via CSS vars:
 * --wax-seal-highlight, --wax-seal-mid, --wax-seal-deep, --wax-seal-letter,
 * --wax-seal-shadow, --wax-seal-emboss-shadow, --wax-seal-font-family.
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
	const embossId = `wax-emboss-${rawId}`;
	const letterId = `wax-letter-${rawId}`;
	const softShadowId = `wax-shadow-${rawId}`;
	const label = initials?.trim() || undefined;
	const typeWeight = label ? resolveTypeWeight(label) : 0;
	const monogramFontSize = resolveInitialsFontSize(typeWeight);
	const letterSpacingEm = label ? resolveLetterSpacingEm(label) : 0;
	// `text-anchor: middle` centers advance width including trailing letter-spacing;
	// nudge x right by half that trailing tracking so the ink is optically centered.
	const monogramX = PLATE_CENTER.x + (letterSpacingEm * monogramFontSize) / 2;
	// Caps have no descender: sit the baseline half a cap-height below the plate center.
	const monogramBaseline = PLATE_CENTER.y + (CAP_HEIGHT_RATIO * monogramFontSize) / 2;
	const monogramRuns = label
		? buildMonogramRuns(label, SEPARATOR_LIFT_EM * monogramFontSize)
		: [];

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
				<linearGradient
					id={gradId}
					gradientUnits="userSpaceOnUse"
					x1="26"
					y1="16"
					x2="96"
					y2="106"
				>
					<stop offset="0%" stopColor="var(--wax-seal-highlight, #f7ddd4)" />
					<stop offset="26%" stopColor="var(--wax-seal-mid, #e8b4a8)" />
					<stop offset="100%" stopColor="var(--wax-seal-deep, #c4897c)" />
				</linearGradient>
				<filter
					id={softShadowId}
					x="-28%"
					y="-28%"
					width="156%"
					height="156%"
					colorInterpolationFilters="sRGB"
				>
					<feDropShadow
						dx="0"
						dy="4"
						stdDeviation="3.2"
						floodColor="var(--wax-seal-shadow, #4a2a24)"
						floodOpacity="0.5"
					/>
					<feDropShadow
						dx="0"
						dy="1.2"
						stdDeviation="1.1"
						floodColor="var(--wax-seal-shadow, #4a2a24)"
						floodOpacity="0.28"
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
					{/* Die relief via shadow only — specular on thin strokes reads as a white disc. */}
					<feGaussianBlur in="SourceAlpha" stdDeviation="0.7" result="blur" />
					<feOffset dx="0.55" dy="0.9" result="offsetBlur" />
					<feFlood
						floodColor="var(--wax-seal-emboss-shadow, #5c322c)"
						floodOpacity="0.52"
						result="shadowColor"
					/>
					<feComposite in="shadowColor" in2="offsetBlur" operator="in" result="shadow" />
					<feComposite in="SourceGraphic" in2="shadow" operator="over" />
				</filter>
				{/*
				  Pressed-wax relief for the initials: a tight contact shadow plus a wax-tinted
				  top light. Kept low so the glyphs stay inside the wax instead of floating
				  above it with a glossy halo.
				*/}
				<filter
					id={letterId}
					x="-20%"
					y="-20%"
					width="140%"
					height="140%"
					colorInterpolationFilters="sRGB"
				>
					<feDropShadow
						dx="0.15"
						dy="0.75"
						stdDeviation="0.42"
						floodColor="var(--wax-seal-emboss-shadow, #5c322c)"
						floodOpacity="0.42"
					/>
					<feDropShadow
						dx="0"
						dy="-0.3"
						stdDeviation="0.28"
						floodColor="var(--wax-seal-highlight, #f7ddd4)"
						floodOpacity="0.2"
					/>
				</filter>
			</defs>

			{/* Melted wax body */}
			<g filter={`url(#${softShadowId})`}>
				<path d={WAX_BODY_D} fill={`url(#${gradId})`} />
			</g>

			{/* Bead — thin melted edge, not a UI outline */}
			<path
				d={WAX_BODY_D}
				fill="none"
				stroke="var(--wax-seal-deep, #b8796c)"
				strokeWidth="0.95"
				opacity="0.24"
			/>

			{/* Recessed monogram plate — uniform tint, so no lighter disc appears */}
			<path
				d={WAX_BODY_D}
				fill="var(--wax-seal-emboss-shadow, #5c322c)"
				opacity="0.09"
				transform={DIE_MAIN_TRANSFORM}
			/>

			{/* Main cuño */}
			<path
				d={WAX_BODY_D}
				fill="none"
				stroke="var(--wax-seal-deep, #c4897c)"
				strokeWidth="1.4"
				opacity="0.82"
				transform={DIE_MAIN_TRANSFORM}
				filter={`url(#${embossId})`}
			/>

			{/* Short catch-light on the upper cuño edge */}
			<path
				d={WAX_BODY_D}
				fill="none"
				stroke="var(--wax-seal-highlight, #f7ddd4)"
				strokeWidth="1.1"
				strokeLinecap="round"
				opacity="0.15"
				pathLength={100}
				strokeDasharray="7 100"
				strokeDashoffset={80}
				transform={DIE_MAIN_TRANSFORM}
			/>

			{/* Inner echo — quiet second line, matte */}
			<path
				d={WAX_BODY_D}
				fill="none"
				stroke="var(--wax-seal-emboss-shadow, #5c322c)"
				strokeWidth="0.8"
				opacity="0.26"
				transform={DIE_ECHO_TRANSFORM}
			/>

			{label ? (
				<text
					x={monogramX}
					y={monogramBaseline}
					textAnchor="middle"
					fontSize={monogramFontSize}
					fontFamily="var(--wax-seal-font-family, 'EB Garamond Variable', 'EB Garamond', Georgia, 'Times New Roman', serif)"
					fontWeight="400"
					letterSpacing={`${letterSpacingEm}em`}
					fill="var(--wax-seal-letter, #5c322c)"
					filter={`url(#${letterId})`}
				>
					{monogramRuns.length > 1
						? monogramRuns.map((run, index) => (
								<tspan key={`${index}-${run.text}`} dy={run.dy}>
									{run.text}
								</tspan>
							))
						: label}
				</text>
			) : (
				<path
					d={WAX_BODY_D}
					fill="none"
					stroke="var(--wax-seal-letter, #5c322c)"
					strokeWidth="1.1"
					opacity="0.45"
					transform={`translate(${PLATE_CENTER.x} ${PLATE_CENTER.y}) scale(0.14) translate(${-BODY_CENTER.x} ${-BODY_CENTER.y})`}
					filter={`url(#${letterId})`}
				/>
			)}
		</svg>
	);
};

export default WaxMonogramSealIcon;
