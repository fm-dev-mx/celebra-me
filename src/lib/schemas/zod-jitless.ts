import { z } from 'zod';

/**
 * Zod for browser bundles. Zod probes `new Function('')` to decide whether to compile fast
 * parsers; under a CSP without `'unsafe-eval'` the probe files a `script-src` violation even
 * though the error is swallowed. `jitless` skips the probe and the generated code.
 * The setting is global, so server modules sharing the bundle use the interpreted path too.
 */
z.config({ jitless: true });

export { z };
