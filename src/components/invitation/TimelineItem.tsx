import { motion } from 'framer-motion';
import React from 'react';

const Icons = {
	waltz: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 21.35c-1.5-2.5-2-4.5-2-6.35 0-3.31 2.69-6 6-6 1.66 0 3-1.34 3-3V4h-2v2c0 .55-.45 1-1 1s-1-.45-1-1V4H4v13.35c0 1.85.5 3.85 2 6.35h6z" />
			<circle cx="16" cy="15" r="3" />
		</svg>
	),
	dinner: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
			<path d="M7 2v20" />
			<path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
		</svg>
	),
	toast: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M8 22h8" />
			<path d="M12 22V15" />
			<path d="M12 15a5 5 0 0 1-5-5V2h10v8a5 5 0 0 1-5 5Z" />
			<path d="m8.5 10 7 0" />
		</svg>
	),
	church: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 22v-9" />
			<path d="M18 22V10l-6-7-6 7v12" />
			<path d="M12 7v4" />
			<path d="M10 9h4" />
		</svg>
	),
	reception: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M6 3h12l4 6-10 12L2 9l4-6Z" />
			<path d="M11 3 8 9l3 12 3-12-3-6Z" />
			<path d="M2 9h20" />
		</svg>
	),
	party: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M9 18V5l12-2v13" />
			<circle cx="6" cy="18" r="3" />
			<circle cx="18" cy="16" r="3" />
		</svg>
	),
	photo: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<rect x="3" y="4" width="18" height="15" rx="2" />
			<circle cx="12" cy="11.5" r="2.5" />
			<path d="m3 19 4.5-5 4 4 4.5-6.5 5 7.5" />
		</svg>
	)
};

interface TimelineItemProps {
	index: number;
	label: string;
	time: string;
	description?: string;
	icon: keyof typeof Icons;
	align: 'left' | 'right';
}

const TimelineItem: React.FC<TimelineItemProps> = ({ index, label, time, description, icon, align }) => {
	const variants = {
		hidden: {
			opacity: 0,
			y: 20,
			x: align === 'left' ? -20 : 20
		},
		visible: {
			opacity: 1,
			y: 0,
			x: 0,
			transition: {
				duration: 0.8,
				delay: index * 0.1,
				ease: [0.33, 1, 0.68, 1] as [number, number, number, number]
			}
		}
	};

	return (
		<motion.div
			className={`itinerary__item itinerary__item--${align}`}
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, margin: "-100px" }}
			variants={variants}
		>
			<div className="itinerary__item-content">
				<div className="itinerary__item-time font-body">{time}</div>
				<h4 className="itinerary__item-label font-heading-formal">{label}</h4>
				{description && <p className="itinerary__item-description font-body">{description}</p>}
			</div>

			<div className="itinerary__item-icon-wrapper">
				<div className="itinerary__item-icon-inner">
					{Icons[icon] || Icons.reception}
				</div>
			</div>

			<div className="itinerary__item-dot" aria-hidden="true"></div>
		</motion.div>
	);
};

export default TimelineItem;
