import React, { useLayoutEffect, useRef } from 'react';

export type PassesSlice = 'confirmed' | 'declined' | 'unused';

interface PassesBarProps {
	total: number;
	slices: Array<{ key: PassesSlice; value: number }>;
	label: string;
	size?: 'regular' | 'small';
}

/** One slice; its width goes through a CSS variable because inline styles are not allowed. */
const PassesBarPart: React.FC<{ slice: PassesSlice; percent: number }> = ({ slice, percent }) => {
	const ref = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		ref.current?.style.setProperty('--part-width', `${percent}%`);
	}, [percent]);
	return <span ref={ref} className={`passes-bar__part passes-bar__part--${slice}`} />;
};

/**
 * Stacked passes bar. Slices differ by lightness and pattern (solid, hatched,
 * dotted) and the empty remainder is "sin respuesta", so color is never the only cue.
 */
const GuestPassesBar: React.FC<PassesBarProps> = ({ total, slices, label, size = 'regular' }) => (
	<div className={`passes-bar passes-bar--${size}`} role="img" aria-label={label}>
		{slices
			.filter((slice) => slice.value > 0)
			.map((slice) => (
				<PassesBarPart
					key={slice.key}
					slice={slice.key}
					percent={total > 0 ? (slice.value / total) * 100 : 0}
				/>
			))}
	</div>
);

export default GuestPassesBar;
