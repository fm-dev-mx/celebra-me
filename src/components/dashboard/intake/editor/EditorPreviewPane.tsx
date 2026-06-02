import { useState, type RefObject } from 'react';
import { DEVICE_LABELS, DEVICE_ORDER, type PreviewDevice } from '@/lib/editor/constants';

interface Props {
	invitationId: string;
	hasUnsavedChanges: boolean;
	previewVersion: number;
	onReload: () => void;
	paneRef?: RefObject<HTMLElement | null>;
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
}: Props) {
	const [device, setDevice] = useState<PreviewDevice>('desktop');
	const iframeUrl = buildPreviewUrl(invitationId, previewVersion, true);
	const fullPreviewUrl = buildPreviewUrl(invitationId, previewVersion, false);

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
					<span>La vista previa se actualizará después de guardar.</span>
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
			<div
				className="invitation-editor__preview-frame"
				data-device={device}
				data-testid="editor-preview-frame"
			>
				<iframe
					key={iframeUrl}
					src={iframeUrl}
					className="invitation-editor__preview-iframe"
					title="Vista previa de la invitación"
				/>
			</div>
		</aside>
	);
}
