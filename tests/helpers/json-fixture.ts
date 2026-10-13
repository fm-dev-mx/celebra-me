import fs from 'node:fs';
import path from 'node:path';

/** Reads and parses a JSON fixture addressed relative to the repository root. */
export function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
