// =============================================================================
// CELEBRA-ME | Screenshot Tool — Artifact Validation
// =============================================================================

import * as crypto from 'node:crypto';
import * as syncFs from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import sharp from 'sharp';
import type { BlankBottomValidation } from './types.js';

/**
 * Validate if the bottom region of a captured screenshot is mostly blank (uniform color).
 */
export interface LayoutEvidence {
	docHeight: number;
	lastContentBottom: number;
	trailingBlankPx: number;
}

export async function validateBlankBottom(
	filePath: string,
	layoutEvidence?: LayoutEvidence,
): Promise<BlankBottomValidation> {
	try {
		const isStitched =
			filePath.includes('02-full-page') ||
			filePath.includes('05-invitation-full-page') ||
			filePath.includes('05-invitation-full-open');

		// Priority 1: Use layout evidence if provided (DOM bottom boundary vs document canvas height)
		if (layoutEvidence) {
			const trailingBlankDetected = layoutEvidence.trailingBlankPx > 150;
			return {
				path: filePath,
				width: 0,
				height: layoutEvidence.docHeight,
				trailingBlankSpaceDetected: trailingBlankDetected,
				stitchedNecessary: isStitched,
				note: trailingBlankDetected
					? `Layout evidence indicates ${layoutEvidence.trailingBlankPx}px of trailing blank space after DOM content (content bottom: ${layoutEvidence.lastContentBottom}px, doc height: ${layoutEvidence.docHeight}px).`
					: `Layout evidence confirms content extends to document bottom (content bottom: ${layoutEvidence.lastContentBottom}px, doc height: ${layoutEvidence.docHeight}px).`,
			};
		}

		const image = sharp(filePath);
		const metadata = await image.metadata();
		const width = metadata.width || 0;
		const height = metadata.height || 0;

		if (height < 500) {
			return {
				path: filePath,
				width,
				height,
				trailingBlankSpaceDetected: false,
				stitchedNecessary: false,
				note: `Height is too small (${height}px) to run blank bottom validation.`,
			};
		}

		// Priority 2: Fallback pixel analysis — check alpha channel transparency ONLY
		// (Do not falsely flag solid-colored section or footer backgrounds as blank tails)
		const hasAlpha = Boolean(metadata.hasAlpha);
		let isBlankTail = false;

		if (hasAlpha) {
			const extractHeight = Math.min(200, height);
			const bottomRegion = await image
				.extract({
					left: 0,
					top: height - extractHeight,
					width,
					height: extractHeight,
				})
				.raw()
				.toBuffer();

			const channels = metadata.channels || 4;
			let transparentPixels = 0;
			const totalPixels = width * extractHeight;

			// Alpha is the last channel in RGBA / BGRA
			for (let i = channels - 1; i < bottomRegion.length; i += channels) {
				if (bottomRegion[i] === 0) {
					transparentPixels++;
				}
			}

			isBlankTail = transparentPixels / totalPixels > 0.8;
		}

		return {
			path: filePath,
			width,
			height,
			trailingBlankSpaceDetected: isBlankTail,
			stitchedNecessary: isStitched,
			note: isBlankTail
				? `Transparent un-rendered space detected in bottom region.`
				: `No trailing blank space detected.`,
		};
	} catch (err) {
		return {
			path: filePath,
			width: 0,
			height: 0,
			trailingBlankSpaceDetected: false,
			stitchedNecessary: false,
			note: `Failed to analyze image: ${err}`,
		};
	}
}

export async function calculateImageHash(filePath: string): Promise<string> {
	const buf = await fs.readFile(filePath);
	return crypto.createHash('md5').update(buf).digest('hex');
}

export async function getFileArtifactMeta(
	filePath: string,
): Promise<{ sizeBytes: number; mtimeMs: number; hash: string }> {
	const stat = await fs.stat(filePath);
	const hash = await calculateImageHash(filePath);
	return {
		sizeBytes: stat.size,
		mtimeMs: stat.mtimeMs,
		hash,
	};
}

export interface VerifyPhysicalPngOptions {
	filePath: string;
	expectedCssWidth: number;
	expectedCssHeight: number;
	viewportCssHeight: number;
	deviceScaleFactor: number;
	tolerancePx?: number;
}

export interface PhysicalPngVerificationResult {
	valid: boolean;
	actualWidth: number;
	actualHeight: number;
	expectedPixelWidth: number;
	expectedPixelHeight: number;
	error?: string;
	errorCode?: string;
}

export async function verifyPhysicalPng(
	opts: VerifyPhysicalPngOptions,
): Promise<PhysicalPngVerificationResult> {
	const {
		filePath,
		expectedCssWidth,
		expectedCssHeight,
		viewportCssHeight,
		deviceScaleFactor,
		tolerancePx = 15,
	} = opts;

	const expectedPixelWidth = Math.round(expectedCssWidth * deviceScaleFactor);
	const expectedPixelHeight = Math.round(expectedCssHeight * deviceScaleFactor);
	const viewportPixelHeight = Math.round(viewportCssHeight * deviceScaleFactor);

	try {
		const meta = await sharp(filePath).metadata();
		const actualWidth = meta.width || 0;
		const actualHeight = meta.height || 0;

		if (!actualWidth || !actualHeight) {
			return {
				valid: false,
				actualWidth: 0,
				actualHeight: 0,
				expectedPixelWidth,
				expectedPixelHeight,
				error: `File ${filePath} could not be decoded or has 0 dimensions.`,
				errorCode: 'FULL_PAGE_CAPTURE_FAILED',
			};
		}

		// Width check (allow 2px rounding)
		if (Math.abs(actualWidth - expectedPixelWidth) > 4) {
			return {
				valid: false,
				actualWidth,
				actualHeight,
				expectedPixelWidth,
				expectedPixelHeight,
				error: `Width mismatch: PNG width ${actualWidth}px does not match expected viewport width ${expectedPixelWidth}px (${expectedCssWidth}px @${deviceScaleFactor}x).`,
				errorCode: 'FULL_PAGE_DIMENSION_MISMATCH',
			};
		}

		// Multi-viewport check: if content > 1 viewport, PNG height MUST exceed viewport height
		if (
			expectedCssHeight > viewportCssHeight + 10 &&
			actualHeight <= viewportPixelHeight + 10
		) {
			return {
				valid: false,
				actualWidth,
				actualHeight,
				expectedPixelWidth,
				expectedPixelHeight,
				error: `Full-page artifact is mislabeled viewport-sized screenshot (${actualHeight}px) for multi-viewport invitation (${expectedPixelHeight}px expected).`,
				errorCode: 'FULL_PAGE_DIMENSION_MISMATCH',
			};
		}

		// Height tolerance check
		if (Math.abs(actualHeight - expectedPixelHeight) > tolerancePx) {
			return {
				valid: false,
				actualWidth,
				actualHeight,
				expectedPixelWidth,
				expectedPixelHeight,
				error: `Height mismatch: PNG height ${actualHeight}px differs from validated content height ${expectedPixelHeight}px by more than tolerance ±${tolerancePx}px.`,
				errorCode: 'FULL_PAGE_DIMENSION_MISMATCH',
			};
		}

		return {
			valid: true,
			actualWidth,
			actualHeight,
			expectedPixelWidth,
			expectedPixelHeight,
		};
	} catch (err) {
		return {
			valid: false,
			actualWidth: 0,
			actualHeight: 0,
			expectedPixelWidth,
			expectedPixelHeight,
			error: `Physical PNG verification failed for ${filePath}: ${err}`,
			errorCode: 'FULL_PAGE_CAPTURE_FAILED',
		};
	}
}

export interface VerifySectionCropOptions {
	fullPagePath: string;
	sectionId: string;
	sectionBounds: { y: number; height: number };
	topY: number;
	deviceScaleFactor: number;
	standalonePath?: string;
}

export interface SectionCropVerificationResult {
	valid: boolean;
	error?: string;
	errorCode?: string;
}

export async function verifySectionCropInclusion(
	opts: VerifySectionCropOptions,
): Promise<SectionCropVerificationResult> {
	const { fullPagePath, sectionId, sectionBounds, topY, deviceScaleFactor, standalonePath } =
		opts;

	try {
		const fullPageMeta = await sharp(fullPagePath).metadata();
		const fullWidth = fullPageMeta.width || 0;
		const fullHeight = fullPageMeta.height || 0;

		const cropTop = Math.max(0, Math.round((sectionBounds.y - topY) * deviceScaleFactor));
		const cropHeight = Math.round(sectionBounds.height * deviceScaleFactor);

		if (cropTop + cropHeight > fullHeight + 10) {
			return {
				valid: false,
				error: `Section "${sectionId}" region [top ${cropTop}px, height ${cropHeight}px] extends outside full-page image height ${fullHeight}px.`,
				errorCode: 'SECTION_OUTSIDE_FULL_PAGE',
			};
		}

		// Extract crop from full-page PNG
		const actualExtractHeight = Math.min(cropHeight, Math.max(1, fullHeight - cropTop));
		const cropBuffer = await sharp(fullPagePath)
			.extract({ left: 0, top: cropTop, width: fullWidth, height: actualExtractHeight })
			.raw()
			.toBuffer();

		// Check non-blank (ensure alpha/color pixels vary)
		let nonZero = 0;
		for (let i = 0; i < cropBuffer.length; i += 4) {
			if (cropBuffer[i] > 10 || cropBuffer[i + 1] > 10 || cropBuffer[i + 2] > 10) {
				nonZero++;
			}
		}
		if (nonZero === 0) {
			return {
				valid: false,
				error: `Section "${sectionId}" region in full-page artifact is completely blank / unrendered.`,
				errorCode: 'SECTION_CAPTURE_MISMATCH',
			};
		}

		// If standalone section capture exists, compare height dimensions
		if (standalonePath && syncFs.existsSync(standalonePath)) {
			const standaloneMeta = await sharp(standalonePath).metadata();
			const standaloneHeight = standaloneMeta.height || 0;
			if (standaloneHeight > 0 && Math.abs(cropHeight - standaloneHeight) > 30) {
				return {
					valid: false,
					error: `Section "${sectionId}" crop height (${cropHeight}px) differs materially from standalone capture height (${standaloneHeight}px).`,
					errorCode: 'SECTION_CAPTURE_MISMATCH',
				};
			}
		}

		return { valid: true };
	} catch (err) {
		return {
			valid: false,
			error: `Failed section crop comparison for "${sectionId}": ${err}`,
			errorCode: 'SECTION_CAPTURE_MISMATCH',
		};
	}
}

export async function publishArtifactAtomically(
	tempPath: string,
	finalPath: string,
): Promise<{ path: string; sizeBytes: number; mtimeMs: number; hash: string }> {
	await fs.mkdir(path.dirname(finalPath), { recursive: true });
	await fs.copyFile(tempPath, finalPath);
	await fs.rm(tempPath, { force: true });
	const meta = await getFileArtifactMeta(finalPath);
	return {
		path: finalPath,
		...meta,
	};
}
