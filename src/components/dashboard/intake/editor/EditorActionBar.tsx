interface Props {
	dirtyCount: number;
	savingAll: boolean;
	publishing: boolean;
	publishWarning: string | null;
	publishDisabled: boolean;
	onSaveAll: () => void;
	onDiscard: () => void;
	onPublish: () => void;
	editUrl: string;
	onPreviewRequest: () => void;
}

export default function EditorActionBar({
	dirtyCount,
	savingAll,
	publishing,
	publishWarning,
	publishDisabled,
	onSaveAll,
	onDiscard,
	onPublish,
	editUrl,
	onPreviewRequest,
}: Props) {
	return (
		<div className="invitation-editor__action-bar">
			<div className="invitation-editor__action-bar-left">
				<a href={editUrl} className="invitation-editor__action-bar-back">
					&larr; Volver
				</a>
				{dirtyCount > 0 && (
					<span className="invitation-editor__action-bar-dirty">
						{dirtyCount} cambio{dirtyCount > 1 ? 's' : ''} sin guardar
					</span>
				)}
			</div>
			<div className="invitation-editor__action-bar-right">
				{dirtyCount > 0 && (
					<>
						<button
							type="button"
							className="invitation-editor__action-bar-btn invitation-editor__action-bar-btn--secondary"
							onClick={onDiscard}
							disabled={savingAll}
						>
							Descartar cambios
						</button>
						<button
							type="button"
							className="invitation-editor__action-bar-btn invitation-editor__action-bar-btn--primary"
							onClick={onSaveAll}
							disabled={savingAll}
						>
							{savingAll ? 'Guardando...' : 'Guardar borrador'}
						</button>
					</>
				)}
				<button
					type="button"
					className="invitation-editor__action-bar-btn invitation-editor__action-bar-btn--secondary"
					onClick={onPreviewRequest}
				>
					Vista previa
				</button>
				<button
					type="button"
					className="invitation-editor__action-bar-btn invitation-editor__action-bar-btn--primary"
					onClick={onPublish}
					disabled={publishDisabled}
					title={publishWarning ?? undefined}
				>
					{publishing ? 'Publicando...' : 'Publicar cambios'}
				</button>
			</div>
		</div>
	);
}
