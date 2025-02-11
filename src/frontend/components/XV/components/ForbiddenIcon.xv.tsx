// src/frontend/components/XV/components/Forbidden.xv.tsx

import React from 'react';

interface Props {
	className?: string;
}

const ForbiddenIcon: React.FC<Props> = ({ className = '' }) => {
	return (
		<div className={className}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<circle cx="12" cy="12" r="10"></circle>
				<line x1="4" y1="4" x2="20" y2="20"></line>
			</svg>
		</div>
	);
};

export default ForbiddenIcon;
