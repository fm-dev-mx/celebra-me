import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { exportInvitationPackage, type InvitationPackageData } from './invitation-package.ts';
import { validatePackageData } from './invitation-import-engine.ts';

export type PackageInputErrorCode =
	'PACKAGE_SOURCE_CONFLICT' | 'PACKAGE_NOT_FOUND' | 'PACKAGE_INVALID' | 'PACKAGE_STALE';

export class PackageInputError extends Error {
	constructor(
		public readonly code: PackageInputErrorCode,
		public readonly safeReason: string,
		public readonly technicalCause?: unknown,
	) {
		super(safeReason, { cause: technicalCause });
		this.name = 'PackageInputError';
	}
}

export interface ResolvedInvitationPackageInput {
	packageData: InvitationPackageData;
	packagePath?: string;
	source: 'file-package' | 'managed-definition';
	/** Current managed-definition sourceHash from dry-run export when resolved. */
	definitionSourceHash?: string;
}

export async function resolveInvitationPackageInput(input: {
	slug: string;
	sourceDir?: string;
	packagePath?: string;
	/** Skip sourceHash freshness check against the current managed definition. */
	allowStalePackage?: boolean;
	exportPackage?: typeof exportInvitationPackage;
}): Promise<ResolvedInvitationPackageInput> {
	if (input.sourceDir && input.packagePath) {
		throw new PackageInputError(
			'PACKAGE_SOURCE_CONFLICT',
			'Use exactamente una fuente: --source-dir para la definición o --package para un paquete inmutable.',
		);
	}

	if (input.packagePath) {
		const absolutePath = resolve(input.packagePath);
		if (!existsSync(absolutePath)) {
			throw new PackageInputError(
				'PACKAGE_NOT_FOUND',
				'No se encontró el paquete indicado. Verifique la ruta y vuelva a ejecutar el preflight.',
			);
		}
		try {
			const parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as InvitationPackageData;
			const packageData = validatePackageData(parsed);
			if (packageData.sourceSlug !== input.slug) {
				throw new PackageInputError(
					'PACKAGE_INVALID',
					`El paquete pertenece a "${packageData.sourceSlug}", no a "${input.slug}".`,
				);
			}

			const exported = await (input.exportPackage ?? exportInvitationPackage)({
				slug: input.slug,
				sourceDir: input.sourceDir ?? '',
				dryRun: true,
			});
			const definitionSourceHash = exported.packageData.sourceHash;
			if (!input.allowStalePackage && packageData.sourceHash !== definitionSourceHash) {
				throw new PackageInputError(
					'PACKAGE_STALE',
					'El paquete está desactualizado respecto a la definición administrada actual (sourceHash distinto). Regenere el paquete desde la definición y vuelva a planificar, o use --allow-stale-package solo si el desfase es intencional.',
					{
						packageSourceHash: packageData.sourceHash,
						definitionSourceHash,
					},
				);
			}

			return {
				packageData,
				packagePath: absolutePath,
				source: 'file-package',
				definitionSourceHash,
			};
		} catch (error) {
			if (error instanceof PackageInputError) throw error;
			throw new PackageInputError(
				'PACKAGE_INVALID',
				'El paquete no es válido o no supera la verificación de integridad. Genérelo nuevamente y repita el preflight.',
				error,
			);
		}
	}

	try {
		const exported = await (input.exportPackage ?? exportInvitationPackage)({
			slug: input.slug,
			sourceDir: input.sourceDir ?? '',
			dryRun: true,
		});
		return {
			packageData: exported.packageData,
			source: 'managed-definition',
			definitionSourceHash: exported.packageData.sourceHash,
		};
	} catch (error) {
		throw new PackageInputError(
			'PACKAGE_INVALID',
			'No fue posible construir un paquete válido desde la definición administrada. Corrija el origen y vuelva a planificar.',
			error,
		);
	}
}
