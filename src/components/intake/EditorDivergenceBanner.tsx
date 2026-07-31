import type { FC } from 'react';

export interface EditorDivergenceBannerProps {
	divergenceState?:
		| 'CLEAN'
		| 'DIVERGED'
		| 'RECONCILIATION_REQUIRED'
		| 'SOURCE_UPDATE_REQUIRED'
		| 'DEFERRED';
	targetEnvironment?: string;
	affectedFieldCount?: number;
	affectedSectionCount?: number;
	affectedSections?: string[];
	isReleaseBlocked?: boolean;
}

export const EditorDivergenceBanner: FC<EditorDivergenceBannerProps> = ({
	divergenceState = 'CLEAN',
	targetEnvironment = 'local',
	affectedFieldCount = 0,
	affectedSectionCount = 0,
	affectedSections = [],
	isReleaseBlocked = false,
}) => {
	if (divergenceState === 'CLEAN' || affectedFieldCount === 0) {
		return null;
	}

	const sectionsSuffix =
		affectedSections.length > 0 ? ` (${affectedSections.join(', ')})` : '';

	return (
		<div
			role="alert"
			className="editor-divergence-banner"
			data-testid="editor-divergence-banner"
			data-divergence-state={divergenceState}
			data-environment={targetEnvironment}
			data-release-blocked={isReleaseBlocked ? 'true' : 'false'}
		>
			<h4 className="editor-divergence-banner__title">
				Cambios pendientes de reconciliar ({targetEnvironment.toUpperCase()})
			</h4>
			<p className="editor-divergence-banner__text">
				Este ambiente contiene{' '}
				<strong>
					{affectedFieldCount} campo(s) modificados en {affectedSectionCount}{' '}
					sección(es)
				</strong>{' '}
				con respecto a la definición canónica{sectionsSuffix}.
			</p>
			{isReleaseBlocked ? (
				<p className="editor-divergence-banner__blocker">
					El lanzamiento está bloqueado hasta ejecutar la reconciliación guiada
					(`pnpm invitation:reconcile`).
				</p>
			) : null}
		</div>
	);
};

export default EditorDivergenceBanner;
