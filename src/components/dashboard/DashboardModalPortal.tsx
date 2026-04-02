import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface DashboardModalPortalProps {
	children: React.ReactNode;
}

let openModalCount = 0;

const DashboardModalPortal: React.FC<DashboardModalPortalProps> = ({ children }) => {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) {
			return;
		}

		openModalCount += 1;
		document.body.classList.add('modal-open');

		return () => {
			openModalCount = Math.max(0, openModalCount - 1);
			if (openModalCount === 0) {
				document.body.classList.remove('modal-open');
			}
		};
	}, [mounted]);

	if (!mounted || typeof document === 'undefined') {
		return null;
	}

	return createPortal(children, document.body);
};

export default DashboardModalPortal;
