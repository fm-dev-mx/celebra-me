// Pull request status through the GitHub CLI. The core only sees the `RepoHost` interface.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type EstadoPr = 'OPEN' | 'MERGED' | 'CLOSED';
export type EstadoChecks = 'verde' | 'rojo' | 'pendiente' | 'sin checks';

export interface InfoPr {
	numero: number;
	estado: EstadoPr;
	checks: EstadoChecks;
	url: string;
	mergeSha?: string;
}

export interface RepoHost {
	pr(numero: number): Promise<InfoPr>;
}

interface Check {
	conclusion?: string | null;
	state?: string | null;
	status?: string | null;
}

export function resumirChecks(checks: readonly Check[]): EstadoChecks {
	if (checks.length === 0) return 'sin checks';
	const resultados = checks.map((check) =>
		(check.conclusion || check.state || check.status || '').toUpperCase(),
	);
	if (
		resultados.some((r) =>
			['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(r),
		)
	) {
		return 'rojo';
	}
	if (resultados.every((r) => ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(r))) return 'verde';
	return 'pendiente';
}

const ejecutar = promisify(execFile);

export class GhCli implements RepoHost {
	private readonly repo: string;

	constructor(repo: string) {
		if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid repository: ${repo}`);
		this.repo = repo;
	}

	async pr(numero: number): Promise<InfoPr> {
		if (!Number.isInteger(numero) || numero < 1)
			throw new Error(`Invalid pull request: ${numero}`);
		const { stdout } = await ejecutar(
			'gh',
			[
				'pr',
				'view',
				String(numero),
				'--repo',
				this.repo,
				'--json',
				'number,state,url,mergeCommit,statusCheckRollup',
			],
			{ timeout: 20_000, windowsHide: true },
		);
		const datos = JSON.parse(stdout) as {
			number: number;
			state: EstadoPr;
			url: string;
			mergeCommit?: { oid?: string } | null;
			statusCheckRollup?: Check[] | null;
		};
		const info: InfoPr = {
			numero: datos.number,
			estado: datos.state,
			checks: resumirChecks(datos.statusCheckRollup ?? []),
			url: datos.url,
		};
		if (datos.mergeCommit?.oid) info.mergeSha = datos.mergeCommit.oid;
		return info;
	}
}
