import React from 'react';

interface GlyphProps {
	size?: number;
	className?: string;
}

export const EditGlyph: React.FC<GlyphProps> = ({ size = 16, className }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		className={className}
	>
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
	</svg>
);

export const DeleteGlyph: React.FC<GlyphProps> = ({ size = 16, className }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		className={className}
	>
		<path d="M3 6h18" />
		<path d="M8 6V4h8v2" />
		<path d="M19 6l-1 14H6L5 6" />
		<path d="M10 11v6" />
		<path d="M14 11v6" />
	</svg>
);

export const CheckGlyph: React.FC<GlyphProps> = ({ size = 16, className }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		className={className}
	>
		<path d="m5 12 5 5L20 7" />
	</svg>
);

const Glyph: React.FC<GlyphProps & { children: React.ReactNode; strokeWidth?: number }> = ({
	size = 16,
	className,
	strokeWidth = 1.8,
	children,
}) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth={strokeWidth}
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		className={className}
	>
		{children}
	</svg>
);

export const ClockGlyph: React.FC<GlyphProps> = (props) => (
	<Glyph {...props}>
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7v5l3 2" />
	</Glyph>
);

export const SentGlyph: React.FC<GlyphProps> = (props) => (
	<Glyph {...props}>
		<path d="M4 12 20 4l-6 16-3-7-7-1Z" />
	</Glyph>
);

export const DeclinedGlyph: React.FC<GlyphProps> = (props) => (
	<Glyph {...props} strokeWidth={2}>
		<path d="M18 6 6 18M6 6l12 12" />
	</Glyph>
);

export const ChevronRightGlyph: React.FC<GlyphProps> = (props) => (
	<Glyph {...props} strokeWidth={2}>
		<path d="m9 6 6 6-6 6" />
	</Glyph>
);

export const ListViewGlyph: React.FC<GlyphProps> = (props) => (
	<Glyph {...props} strokeWidth={2}>
		<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
	</Glyph>
);

export const CardViewGlyph: React.FC<GlyphProps> = (props) => (
	<Glyph {...props}>
		<rect x="4" y="4" width="16" height="7" rx="2" />
		<rect x="4" y="14" width="16" height="7" rx="2" />
	</Glyph>
);

export const MessageGlyph: React.FC<GlyphProps> = (props) => (
	<Glyph {...props}>
		<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
	</Glyph>
);
