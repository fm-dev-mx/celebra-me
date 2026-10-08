/**
 * Single availability entry point for every caller that needs the disposable database on 54332.
 * A stopped container (e.g. `Exited (255)` after a Docker restart) is started with the same
 * mechanism as `pnpm db:disposable:start`.
 */
import { DISPOSABLE_TEST, fail } from './db-workflow-lib.ts';
import { cmdStart, isDisposableDbReady } from './disposable-test-env.ts';

export const DISPOSABLE_START_COMMAND = 'pnpm db:disposable:start';

export interface DisposableAvailability {
	reachable: boolean;
	/** True when this call had to start (or recreate) the container. */
	started: boolean;
	error?: string;
}

export interface DisposableAvailabilityDeps {
	isReady?: () => boolean;
	start?: () => void;
	log?: (message: string) => void;
}

/** Starts a stopped disposable container; never throws so callers decide how to fail. */
export function ensureDisposableDbAvailable(
	deps: DisposableAvailabilityDeps = {},
): DisposableAvailability {
	const isReady = deps.isReady ?? isDisposableDbReady;
	const start = deps.start ?? cmdStart;
	const log = deps.log ?? ((message: string) => console.info(message));
	if (isReady()) return { reachable: true, started: false };
	log(
		`Disposable database not reachable on port ${DISPOSABLE_TEST.dbPort}. Starting ${DISPOSABLE_TEST.containerName}...`,
	);
	try {
		start();
	} catch (err) {
		return {
			reachable: false,
			started: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
	return isReady()
		? { reachable: true, started: true }
		: { reachable: false, started: true, error: 'Database did not answer after start.' };
}

/** Fail-closed variant: exits with the exact operator command when the container stays down. */
export function requireDisposableDbAvailable(deps: DisposableAvailabilityDeps = {}): void {
	const availability = ensureDisposableDbAvailable(deps);
	if (availability.reachable) return;
	fail(
		`Disposable database ${DISPOSABLE_TEST.containerName} (port ${DISPOSABLE_TEST.dbPort}) is unavailable` +
			`${availability.error ? `: ${availability.error}` : '.'} Start it with: ${DISPOSABLE_START_COMMAND}`,
	);
}
