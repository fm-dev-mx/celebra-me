import React, { useEffect, useRef } from 'react';
import { CheckIcon, CopyIcon } from '@/components/common/icons/ui';
import ModalShell from '@/components/dashboard/ModalShell';
import { useClipboard } from '@/hooks/use-clipboard';

interface CopyLinkButtonProps {
	url: string;
	guestName: string;
	/** `text` shows the label; `icon` is a 44px square for dense compact rows. */
	variant?: 'text' | 'icon';
	className?: string;
}

interface CopyLinkFallbackDialogProps {
	url: string;
	guestName: string;
	onClose: () => void;
}

/** Manual copy when the browser blocks the clipboard (in-app browsers, denied permission). */
const CopyLinkFallbackDialog: React.FC<CopyLinkFallbackDialogProps> = ({
	url,
	guestName,
	onClose,
}) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

	// ModalShell focuses its first control in a zero-delay timer queued after this
	// effect's; re-queueing once lands the focus and selection on the link instead.
	useEffect(() => {
		let inner: number | undefined;
		const outer = window.setTimeout(() => {
			inner = window.setTimeout(() => {
				inputRef.current?.focus();
				inputRef.current?.select();
			}, 0);
		}, 0);
		return () => {
			window.clearTimeout(outer);
			window.clearTimeout(inner);
		};
	}, []);

	const handleShare = async () => {
		try {
			await navigator.share({ title: `Invitación de ${guestName}`, url });
			onClose();
		} catch {
			// Dismissed share sheet: keep the dialog so the host can copy by hand.
		}
	};

	return (
		<ModalShell
			title="Copie el enlace manualmente"
			subtitle={guestName}
			size="sm"
			fullscreenOnMobile={false}
			className="copy-link-fallback"
			onClose={onClose}
			footer={
				<div className="copy-link-fallback__actions">
					{canShare && (
						<button type="button" className="btn-primary" onClick={handleShare}>
							Compartir…
						</button>
					)}
					<button type="button" className="btn-secondary" onClick={onClose}>
						Cerrar
					</button>
				</div>
			}
		>
			<div className="dashboard-modal__content copy-link-fallback__body">
				<p className="copy-link-fallback__hint">
					Su navegador no permitió copiar. Mantenga presionado el enlace (o use Ctrl+C) y
					elija «Copiar».
				</p>
				<label className="sr-only" htmlFor="copy-link-fallback-url">
					Enlace de la invitación
				</label>
				<input
					id="copy-link-fallback-url"
					ref={inputRef}
					className="copy-link-fallback__input"
					type="text"
					readOnly
					value={url}
					onFocus={(event) => event.currentTarget.select()}
				/>
			</div>
		</ModalShell>
	);
};

/** Always-available copy action for a guest's invitation link, in every status. */
const CopyLinkButton: React.FC<CopyLinkButtonProps> = ({
	url,
	guestName,
	variant = 'text',
	className = '',
}) => {
	const { status, copy, reset } = useClipboard();
	const copied = status === 'copied';
	const label = copied ? 'Enlace copiado' : 'Copiar enlace';

	return (
		<>
			<button
				type="button"
				className={`copy-link-button copy-link-button--${variant}${copied ? ' copy-link-button--copied' : ''} ${className}`.trim()}
				onClick={(event) => {
					event.stopPropagation();
					void copy(url);
				}}
				aria-label={
					variant === 'icon'
						? `${copied ? 'Enlace copiado' : 'Copiar enlace'} de ${guestName}`
						: undefined
				}
				title={variant === 'icon' ? label : undefined}
			>
				{copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
				{variant === 'text' && <span>{label}</span>}
			</button>
			<span className="sr-only" role="status" aria-live="polite">
				{copied ? `Enlace de ${guestName} copiado` : ''}
			</span>
			{status === 'failed' && (
				<CopyLinkFallbackDialog url={url} guestName={guestName} onClose={reset} />
			)}
		</>
	);
};

export default CopyLinkButton;
