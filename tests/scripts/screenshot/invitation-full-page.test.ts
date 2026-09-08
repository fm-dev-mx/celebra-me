import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { Page } from 'playwright';
import { captureInvitationDocumentSpaceFullPage } from '../../../scripts/screenshot/invitation-full-page';

test('concurrent full-page captures do not share temporary strips', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'invitation-capture-'));
	const now = jest.spyOn(Date, 'now').mockReturnValue(12345);
	const makePage = async (color: string) => {
		const png = await sharp({
			create: { width: 20, height: 20, channels: 4, background: color },
		})
			.png()
			.toBuffer();
		return {
			viewportSize: () => ({ width: 20, height: 20 }),
			evaluate: async () => ({ alreadyInjected: true, alreadyActive: true }),
			waitForTimeout: async () => {},
			context: () => ({
				newCDPSession: async () => ({
					send: async () => ({ data: png.toString('base64') }),
					detach: async () => {},
				}),
			}),
		} as unknown as Page;
	};
	try {
		const red = path.join(root, 'red.png');
		const blue = path.join(root, 'blue.png');
		const [a, b] = await Promise.all([makePage('#ff0000'), makePage('#0000ff')]);
		await Promise.all([
			captureInvitationDocumentSpaceFullPage(a, red, 'png', 0, 40, 20, {
				deviceScaleFactor: 1,
			}),
			captureInvitationDocumentSpaceFullPage(b, blue, 'png', 0, 40, 20, {
				deviceScaleFactor: 1,
			}),
		]);
		const redPixel = await sharp(red)
			.extract({ left: 0, top: 30, width: 1, height: 1 })
			.raw()
			.toBuffer();
		const bluePixel = await sharp(blue)
			.extract({ left: 0, top: 30, width: 1, height: 1 })
			.raw()
			.toBuffer();
		expect([...redPixel]).toEqual([255, 0, 0, 255]);
		expect([...bluePixel]).toEqual([0, 0, 255, 255]);
		expect((await fs.readdir(root)).sort()).toEqual(['blue.png', 'red.png']);
	} finally {
		now.mockRestore();
		await fs.rm(root, { recursive: true, force: true });
	}
});
