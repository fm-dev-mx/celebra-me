import React, { useEffect, useId, useRef } from 'react';
import DashboardModalPortal from '@/components/dashboard/DashboardModalPortal';

let activeModalShells = 0;
let dashboardShellWasInert = false;

interface ModalShellProps {
	title: string;
	subtitle?: React.ReactNode;
	className?: string;
	onClose: () => void;
	children: React.ReactNode;
	variant?: 'default' | 'confirm';
	size?: 'sm' | 'md' | 'lg';
	fullscreenOnMobile?: boolean;
	footer?: React.ReactNode;
	descriptionId?: string;
	disableClose?: boolean;
	initialFocus?: 'heading' | 'first-control';
}

const ModalShell: React.FC<ModalShellProps> = ({
	title,
	subtitle,
	className,
	onClose,
	children,
	variant = 'default',
	size = 'md',
	fullscreenOnMobile = true,
	footer,
	descriptionId,
	disableClose = false,
	initialFocus = 'first-control',
}) => {
	const titleId = useId();
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const triggerRef = useRef<HTMLElement | null>(null);
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);
	useEffect(() => {
		triggerRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const shell = document.querySelector<HTMLElement>('.dashboard-shell');
		if (activeModalShells === 0) dashboardShellWasInert = shell?.hasAttribute('inert') ?? false;
		activeModalShells += 1;
		shell?.setAttribute('inert', '');
		const focusable = () =>
			Array.from(
				dialogRef.current?.querySelectorAll<HTMLElement>(
					'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
				) ?? [],
			);
		const focusTimer = window.setTimeout(() => {
			const initial = initialFocus === 'heading' ? titleRef.current : focusable()[0];
			const fallback = initial ?? focusable()[0] ?? dialogRef.current;
			fallback?.focus();
		}, 0);
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !disableClose) {
				event.preventDefault();
				onCloseRef.current();
			}
			if (event.key !== 'Tab') return;
			const items = focusable();
			if (items.length === 0) return;
			const index = items.indexOf(document.activeElement as HTMLElement);
			if (event.shiftKey && (index <= 0 || document.activeElement === dialogRef.current)) {
				event.preventDefault();
				items.at(-1)?.focus();
			} else if (!event.shiftKey && index === items.length - 1) {
				event.preventDefault();
				items[0]?.focus();
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => {
			window.clearTimeout(focusTimer);
			document.removeEventListener('keydown', onKeyDown);
			activeModalShells = Math.max(0, activeModalShells - 1);
			if (activeModalShells === 0 && !dashboardShellWasInert) shell?.removeAttribute('inert');
			triggerRef.current?.focus();
		};
	}, [disableClose, initialFocus]);
	let modalClass = 'dashboard-modal';
	if (variant === 'confirm') modalClass += ' dashboard-modal--confirm';
	if (size === 'lg') modalClass += ' dashboard-modal--full';
	if (!fullscreenOnMobile) modalClass += ' dashboard-modal--not-fullscreen';
	if (className) modalClass += ' ' + className;

	return (
		<DashboardModalPortal>
			<div
				className="dashboard-modal-backdrop"
				onClick={(e) => {
					if (!disableClose && e.target === e.currentTarget) onClose();
				}}
			>
				<div
					ref={dialogRef}
					className={modalClass}
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					aria-describedby={descriptionId}
					tabIndex={-1}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="dashboard-modal__header">
						<div className="dashboard-modal__header-content">
							<h3 ref={titleRef} id={titleId} tabIndex={-1}>
								{title}
							</h3>
							{subtitle && <p className="dashboard-modal__subtitle">{subtitle}</p>}
						</div>
						<button
							type="button"
							className="btn-close"
							onClick={onClose}
							disabled={disableClose}
							aria-label="Cerrar modal"
						>
							✕
						</button>
					</div>
					{children}
					{footer && <div className="dashboard-modal__footer">{footer}</div>}
				</div>
			</div>
		</DashboardModalPortal>
	);
};

export default ModalShell;
