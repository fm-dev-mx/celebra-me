import React from 'react';

interface IconProps {
	className?: string;
	size?: number | string;
}

/**
 * Accordion icon for music-focused invitation moments.
 * Source: SVG Repo
 */
export const AccordionIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 48 48"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		role="img"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M11.838 35.701c-1.46.529-2.638-.437-3.188-2.181L4.894 21.592a2.969 2.969 0 0 1 1.229-3.484l2.607-1.176.933-.412c1.086-.479 1.803-.21 2.184 1.012l4.563 14.619c.382 1.225.274 1.795-.718 2.154Z" />
		<path d="M16.409 32.151c5.684-2.449 8.607-2.893 14.937-.894" />
		<path d="m11.946 17.449.92-2.94L15.12 16.488l2.275 8.384" />
		<path d="m8.729 16.932.708 2.23-2.11.747" />
		<path d="m9.437 19.162.707 2.23-2.11.747" />
		<path d="m10.144 21.392.707 2.23-2.11.747" />
		<path d="m10.851 23.621.708 2.23-2.11.747" />
		<path d="m11.559 25.851.707 2.23-2.11.748" />
		<path d="m12.266 28.081.707 2.23-2.11.748" />
		<path d="m12.973 30.311.707 2.23-2.11.748" />
		<path d="m13.681 32.541.707 2.23" />
		<path d="m15.12 16.488 1.158-2.844 2.083 2.179 1.575 8.561" />
		<path d="m18.361 15.822 1.389-2.727 1.894 2.362.863 8.674" />
		<path d="m21.644 15.457 1.608-2.588 1.693 2.527.144 8.721" />
		<path d="m24.945 15.396 1.815-2.43 1.478 2.674-.575 8.701" />
		<path d="m28.238 15.64 2.009-2.254 1.252 2.8L30.208 24.8" />
		<path d="m31.499 16.186 2.187-2.06 1.016 2.904" />
		<path d="m31.05 32.507.295-1.25 3.357-14.227.375-1.583" />
		<path d="m35.077 15.447 6.903 1.822a2.485 2.485 0 0 1 1.69 3.073L40.798 32.51a2.381 2.381 0 0 1-3.196 1.727L31.05 32.507" />
		<circle cx="37.225" cy="18.926" r=".75" fill="currentColor" stroke="none" />
		<circle cx="36.235" cy="22.798" r=".75" fill="currentColor" stroke="none" />
		<circle cx="35.386" cy="26.824" r=".75" fill="currentColor" stroke="none" />
		<circle cx="34.316" cy="30.756" r=".75" fill="currentColor" stroke="none" />
		<circle cx="38.217" cy="29.844" r=".75" fill="currentColor" stroke="none" />
		<circle cx="39.255" cy="25.66" r=".75" fill="currentColor" stroke="none" />
		<circle cx="40.167" cy="21.508" r=".75" fill="currentColor" stroke="none" />
	</svg>
);

export default AccordionIcon;
