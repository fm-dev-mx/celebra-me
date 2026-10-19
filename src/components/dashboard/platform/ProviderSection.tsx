import ProviderLogo from '@/components/dashboard/platform/ProviderLogo';
import ProviderUsageCard from '@/components/dashboard/platform/ProviderUsageCard';
import {
	platformCopy,
	platformEnvironmentLabel,
	platformGroupCopy,
	platformProviderLink,
	platformProviderName,
	platformProviderNote,
	platformProviderPlan,
	type PlatformDeployment,
} from '@/lib/platform/dashboard-copy';
import type { PlatformProviderView } from '@/lib/platform/report-view';

interface Props {
	view: PlatformProviderView;
	deployment: PlatformDeployment;
}

export default function ProviderSection({ view, deployment }: Props) {
	const { provider } = view;
	const name = platformProviderName[provider];
	const headingId = `platform-provider-${provider}`;
	const environmentHint =
		provider === 'cloudflare'
			? platformGroupCopy.cloudflareEnvironmentHint
			: platformGroupCopy.supabaseEnvironmentHint;
	return (
		<section className="platform-provider" aria-labelledby={headingId}>
			<header className="platform-provider__header">
				<ProviderLogo provider={provider} />
				<div className="platform-provider__heading">
					<h2 id={headingId}>{name}</h2>
					<p className="platform-provider__plan">{platformProviderPlan[provider]}</p>
				</div>
				<a
					className="platform-link platform-provider__link"
					href={platformProviderLink[provider]}
					target="_blank"
					rel="noopener noreferrer"
				>
					{platformCopy.link(name)}
					<span className="sr-only"> (se abre en otra pestaña)</span>
				</a>
			</header>
			<p className="platform-provider__note">{platformProviderNote[provider]}</p>

			{view.shared ? (
				<ProviderUsageCard
					title={platformGroupCopy.sharedTitle}
					label={`${name} · ${platformGroupCopy.sharedTitle}`}
					hint={platformGroupCopy.sharedHint}
					headingLevel={3}
					usage={view.shared}
					deployment={deployment}
				/>
			) : null}

			{view.environments.length > 0 ? (
				<div className="platform-group">
					<h3 className="platform-group__title">{platformGroupCopy.environmentsTitle}</h3>
					<p className="platform-group__hint">{environmentHint}</p>
					<div className="platform-group__grid">
						{view.environments.map(({ environment, usage }) => (
							<ProviderUsageCard
								key={environment}
								title={platformEnvironmentLabel[environment]}
								label={`${name} · ${platformEnvironmentLabel[environment]}`}
								headingLevel={4}
								usage={usage}
								deployment={deployment}
							/>
						))}
					</div>
				</div>
			) : null}
		</section>
	);
}
