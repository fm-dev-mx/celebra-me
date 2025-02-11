// src/frontend/components/XV/components/EnvelopedIcon.xv.tsx

import React from 'react';

interface Props {
	className?: string;
}

const EnvelopedIcon: React.FC<Props> = ({ className = '' }) => {
	return (
		<div className={className}>
			<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
				<path d="M28.05 30.7c.98 0 1.87-.44 2.88-1.47L51.32 9.05c-.87-.84-2.48-1.24-4.8-1.24H8.78c-1.97 0-3.35.37-4.12 1.15l20.5 20.27c1.01 1 1.93 1.48 2.89 1.48ZM2.7 44.43l16.57-16.38-16.61-16.4c-.35.66-.54 1.78-.54 3.4v25.88c0 1.66.22 2.83.6 3.49Zm50.63-.03c.35-.68.54-1.82.54-3.46V15.05c0-1.57-.17-2.7-.52-3.33L36.8 28.04ZM9.48 48.2h37.74c1.97 0 3.33-.37 4.1-1.12L34.45 30.33l-1.58 1.57c-1.59 1.55-3.11 2.25-4.82 2.25-1.71 0-3.24-.7-4.83-2.25l-1.57-1.57L4.8 47.04c.89.78 2.46 1.15 4.68 1.15Z" />
			</svg>
		</div>
	);
};

export default EnvelopedIcon;
