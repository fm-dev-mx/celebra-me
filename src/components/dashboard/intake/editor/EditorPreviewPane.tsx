import { useEffect, useRef, useState, type RefObject } from 'react';
import {
	DEVICE_LABELS,
	DEVICE_ORDER,
	DEVICE_VIEWPORT_WIDTHS,
	type PreviewDevice,
} from '@/lib/editor/constants';

export function getPreviewScale(
	availableWidth: number,
	virtualWidth: number,
	maxScale = 1,
): number {
	if (availableWidth <= 0 || virtualWidth <= 0) return 1;
	if (virtualWidth <= availableWidth) return 1;
	return Math.min(availableWidth / virtualWidth, maxScale);
}

interface Props {
	invitationId: string;
	hasUnsavedChanges: boolean;
	previewVersion: number;
	onReload: () => void;
	paneRef?: RefObject<HTMLElement | null>;
	previewHash: string;
}

function buildPreviewUrl(invitationId: string, previewVersion: number, embedded: boolean): string {
	const id = encodeURIComponent(invitationId);
	const query = embedded ? `embed=1&v=${previewVersion}` : `v=${previewVersion}`;
	return `/dashboard/invitaciones/${id}/preview?${query}`;
}

export default function EditorPreviewPane({
	invitationId,
	hasUnsavedChanges,
	previewVersion,
	onReload,
	paneRef,
	previewHash = '',
}: Props) {
	const [device, setDevice] = useState<PreviewDevice>('desktop');
	const iframeBaseUrl = buildPreviewUrl(invitationId, previewVersion, true);
	const iframeSrc = previewHash ? `${iframeBaseUrl}${previewHash}` : iframeBaseUrl;
	const iframeKey = `preview-v${previewVersion}`;
	const fullPreviewUrl = buildPreviewUrl(invitationId, previewVersion, false);
	const viewportWidth = DEVICE_VIEWPORT_WIDTHS[device];

	const frameRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const [frameRect, setFrameRect] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const el = frameRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setFrameRect({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				});
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const scale = getPreviewScale(frameRect.width, viewportWidth);
	const needsScaling = scale < 1;
	const viewportHeight =
		needsScaling && frameRect.height > 0 ? Math.ceil(frameRect.height / scale) : undefined;

	useEffect(() => {
		const el = viewportRef.current;
		if (!el) return;
		el.style.setProperty('--vp-width', `${viewportWidth}px`);
		el.style.setProperty(
			'--vp-height',
			viewportHeight != null ? `${viewportHeight}px` : 'auto',
		);
		el.style.setProperty('--vp-scale', needsScaling ? String(scale) : '1');
	}, [viewportWidth, viewportHeight, scale, needsScaling]);

	return (
		<aside
			ref={paneRef}
			className="invitation-editor__preview-pane"
			aria-labelledby="editor-preview-title"
			tabIndex={-1}
		>
			<div className="invitation-editor__preview-toolbar">
				<div>
					<h2 id="editor-preview-title">Vista previa</h2>
					<p>Última versión guardada</p>
				</div>
				<div className="invitation-editor__preview-actions">
					<button
						type="button"
						className="invitation-editor__action-bar-btn invitation-editor__action-bar-btn--secondary"
						onClick={onReload}
					>
						Recargar
					</button>
					<a
						className="invitation-editor__action-bar-btn invitation-editor__action-bar-btn--secondary"
						href={fullPreviewUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						Abrir vista completa
					</a>
				</div>
			</div>
			{hasUnsavedChanges && (
				<div className="invitation-editor__preview-stale" role="status">
					<strong>Hay cambios sin guardar</strong>
					<span>
						La vista previa muestra la última versión guardada. Los datos que editas
						aquí no se reflejarán hasta que guardes.
					</span>
				</div>
			)}
			<div
				className="invitation-editor__preview-device-tabs"
				aria-label="Tamaño de vista previa"
			>
				{DEVICE_ORDER.map((item) => (
					<button
						key={item}
						type="button"
						aria-pressed={device === item}
						onClick={() => setDevice(item)}
					>
						{DEVICE_LABELS[item]}
					</button>
				))}
			</div>
			<div className="invitation-editor__preview-dimension">
				{viewportWidth}px
				{device === 'desktop' && (
					<>
						{' '}
						&middot; Escala limitada por el panel. Usa &ldquo;Abrir vista
						completa&rdquo; para escritorio real.
					</>
				)}
			</div>
			<div
				ref={frameRef}
				className="invitation-editor__preview-frame"
				data-device={device}
				data-viewport-width={viewportWidth}
				data-testid="editor-preview-frame"
			>
				<div ref={viewportRef} className="invitation-editor__preview-viewport">
					<iframe
						key={iframeKey}
						src={iframeSrc}
						width={viewportWidth}
						className="invitation-editor__preview-iframe"
						title="Vista previa de la invitación"
					/>
				</div>
			</div>
		</aside>
	);
}
