import type { FC } from 'react';

export interface EditorDivergenceBannerProps {
	divergenceState?: 'CLEAN' | 'DIVERGED' | 'RECONCILIATION_REQUIRED' | 'SOURCE_UPDATE_REQUIRED' | 'DEFERRED';
	targetEnvironment?: string;
	affectedFieldCount?: number;
	affectedSectionCount?: number;
	isReleaseBlocked?: boolean;
}

export const EditorDivergenceBanner: FC<EditorDivergenceBannerProps> = ({
	divergenceState = 'CLEAN',
	targetEnvironment = 'local',
	affectedFieldCount = 0,
	affectedSectionCount = 0,
	isReleaseBlocked = false,
}) => {
	if (divergenceState === 'CLEAN' || affectedFieldCount === 0) {
		return null;
	}

	return (
		<div
			role="alert"
			className="my-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm transition-all dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
			data-testid="editor-divergence-banner"
		>
			<div className="flex items-start gap-3">
				<div className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400">
					<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				<div className="flex-1 text-sm">
					<h4 className="font-semibold text-amber-950 dark:text-amber-100">
						Cambios pendientes de reconciliar ({targetEnvironment.toUpperCase()})
					</h4>
					<p className="mt-1 leading-relaxed">
						Este ambiente contiene{' '}
						<strong>
							{affectedFieldCount} campo(s) modificados en {affectedSectionCount} sección(es)
						</strong>{' '}
						con respecto a la definición canónica.
						{isReleaseBlocked && (
							<span className="block mt-1 font-medium text-amber-800 dark:text-amber-300">
								⚠ El lanzamiento está bloqueado hasta ejecutar la reconciliación guiada.
							</span>
						)}
					</p>
				</div>
			</div>
		</div>
	);
};

export default EditorDivergenceBanner;
