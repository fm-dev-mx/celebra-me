import {
	MEMORIES_CAPACITY_REFERENCE,
	estimateMemoriesCapacity,
} from '@/lib/memories/contract/capacity';
import type { MemoriesSpaceLimits } from '@/lib/memories/contract/limits';
import {
	MEMORIES_MAX_VIDEO_BYTES,
	MEMORIES_MAX_VIDEO_DURATION_SECONDS,
} from '@/lib/memories/contract/media-policy';
import { memoriesCapacityCopy as copy } from '@/lib/memories/dashboard-copy';

interface Props {
	limits: MemoriesSpaceLimits;
}

function approx(value: number): string {
	return `≈ ${value.toLocaleString('es-MX')}`;
}

/** Reads a quota as photos, videos and guests; recomputed as the limits change. */
export default function MemoriesCapacityExamples({ limits }: Props) {
	const estimate = estimateMemoriesCapacity(limits);
	const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;
	const maxVideo = `${Math.round(MEMORIES_MAX_VIDEO_BYTES / (1024 * 1024))} MB`;

	return (
		<section className="memories-form__capacity" aria-label={copy.title}>
			<h4>{copy.title}</h4>
			<dl>
				<div>
					<dt>{copy.photosOnly}</dt>
					<dd>
						{approx(estimate.photosOnly)}
						{estimate.photosBoundByFiles ? (
							<small>{copy.photosBoundByFiles}</small>
						) : null}
					</dd>
				</div>
				<div>
					<dt>{copy.videosOnly}</dt>
					<dd>
						{approx(estimate.videosOnly)}
						<small>
							{copy.videosAtMaxSize(
								estimate.videosAtMaxSize.toLocaleString('es-MX'),
								maxVideo,
							)}
						</small>
					</dd>
				</div>
				<div>
					<dt>{copy.mix(MEMORIES_CAPACITY_REFERENCE.photosPerVideo)}</dt>
					<dd>{copy.mixValue(approx(estimate.mixPhotos), approx(estimate.mixVideos))}</dd>
				</div>
				<div>
					<dt>{copy.guests(estimate.guestPhotos, estimate.guestVideos)}</dt>
					<dd>{approx(estimate.guestsAtFullAllowance)}</dd>
				</div>
			</dl>
			<p>
				{copy.disclaimer(
					megabytes(MEMORIES_CAPACITY_REFERENCE.photoBytes),
					megabytes(MEMORIES_CAPACITY_REFERENCE.videoBytes),
					MEMORIES_MAX_VIDEO_DURATION_SECONDS,
					maxVideo,
				)}
			</p>
		</section>
	);
}
