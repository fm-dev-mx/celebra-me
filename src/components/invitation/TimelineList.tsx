import React, { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

// Types (should match internal TimelineItem logic or be shared)
type IconType =
	| 'waltz'
	| 'dinner'
	| 'toast'
	| 'cake'
	| 'party'
	| 'church'
	| 'reception'
	| 'music'
	| 'photo';

interface TimelineItemData {
	icon: IconType;
	label: string;
	description?: string;
	time: string;
}

interface TimelineListProps {
	items: TimelineItemData[];
}

// Icon Components (Embedded for single-file portability or could be imported)
const Icons: Record<string, React.JSX.Element> = {
	waltz: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 21.35c-1.5-2.5-2-4.5-2-6.35 0-3.31 2.69-6 6-6 1.66 0 3-1.34 3-3V4h-2v2c0 .55-.45 1-1 1s-1-.45-1-1V4H4v13.35c0 1.85.5 3.85 2 6.35h6z" />
			<circle cx="16" cy="15" r="3" />
		</svg>
	),
	dinner: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
			<path d="M7 2v20" />
			<path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
		</svg>
	),
	toast: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M8 22h8" />
			<path d="M12 22V15" />
			<path d="M12 15a5 5 0 0 1-5-5V2h10v8a5 5 0 0 1-5 5Z" />
			<path d="m8.5 10 7 0" />
		</svg>
	),
	church: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12 22v-9" />
			<path d="M18 22V10l-6-7-6 7v12" />
			<path d="M12 7v4" />
			<path d="M10 9h4" />
		</svg>
	),
	reception: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
			<path d="M11 3 8 9l3 12 3-12-3-6Z" />
			<path d="M2 9h20" />
		</svg>
	),
	party: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M2 13a2 2 0 1 0 0 4h20a2 2 0 1 0 0-4h-2a2 2 0 1 0 0-4H4a2 2 0 1 0 0 4H2Z" />
			<path d="M12 13v9" />
			<path d="M12 2v2" />
			<path d="m4.93 4.93 1.41 1.41" />
			<path d="M2 12h2" />
			<path d="M20 12h2" />
			<path d="m19.07 4.93-1.41 1.41" />
		</svg>
	),
	cake: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
			<path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
			<path d="M2 21h20" />
			<path d="M7 8v3" />
			<path d="M12 8v3" />
			<path d="M17 8v3" />
			<path d="M7 4h.01" />
			<path d="M12 4h.01" />
			<path d="M17 4h.01" />
		</svg>
	),
	music: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M9 18V5l12-2v13" />
			<circle cx="6" cy="18" r="3" />
			<circle cx="18" cy="16" r="3" />
		</svg>
	),
	photo: (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="4" width="18" height="15" rx="2" />
			<circle cx="12" cy="11.5" r="2.5" />
			<path d="m3 19 4.5-5 4 4 4.5-6.5 5 7.5" />
		</svg>
	),
};

import type { Variants } from 'framer-motion';

const listVariants: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.15,
		},
	},
};

const itemVariants: Variants = {
	hidden: { opacity: 0, scale: 0.9, y: 20 },
	visible: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: {
			duration: 0.6,
			ease: 'easeOut',
		},
	},
};

const TimelineList: React.FC<TimelineListProps> = ({ items }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ['start end', 'end end'],
	});

	const scaleY = useSpring(scrollYProgress, {
		stiffness: 100,
		damping: 30,
		restDelta: 0.001,
	});

	return (
		<div ref={containerRef} className="itinerary__items-wrapper">
			{/* Animated SVG Line */}
			<div className="itinerary__animated-line-container" aria-hidden="true">
				<svg width="2" height="100%" viewBox="0 0 2 100" preserveAspectRatio="none">
					<motion.path
						d="M 1 0 L 1 100"
						stroke="var(--color-primary, #d4af37)"
						strokeWidth="2"
						strokeDasharray="100"
						style={{
							pathLength: scaleY,
							filter: 'drop-shadow(0 0 8px var(--color-primary))',
						}}
					/>
				</svg>
			</div>

			<motion.div
				className="itinerary__items"
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: '-100px' }}
				variants={listVariants}
			>
				{items.map((item, index) => {
					const align = index % 2 === 0 ? 'left' : 'right';
					return (
						<motion.div
							key={index}
							className={`itinerary__item itinerary__item--${align}`}
							variants={itemVariants}
						>
							<div className="itinerary__item-content">
								<div className="itinerary__item-time font-body">{item.time}</div>
								<h4 className="itinerary__item-label font-heading-formal">
									{item.label}
								</h4>
								{item.description && (
									<p className="itinerary__item-description font-body">
										{item.description}
									</p>
								)}
							</div>

							<div className="itinerary__item-icon-wrapper">
								<div className="itinerary__item-icon-inner">
									{Icons[item.icon] || Icons.reception}
								</div>
							</div>

							<div className="itinerary__item-dot" aria-hidden="true"></div>
						</motion.div>
					);
				})}
			</motion.div>
		</div>
	);
};

export default TimelineList;
