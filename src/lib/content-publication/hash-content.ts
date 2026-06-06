import { createHash } from 'node:crypto';
import { stableStringify } from '@/lib/content-publication/normalize-content';

export function hashContent(content: unknown): string {
	return createHash('sha256').update(stableStringify(content), 'utf8').digest('hex');
}
