import type { FC, ReactNode } from 'react';

interface Props {
	title: string;
	subtitle?: string;
	action?: ReactNode;
	backLink?: { href: string; label: string };
}

const DashboardPageHeader: FC<Props> = ({ title, subtitle, action, backLink }) => {
	return (
		<header className="dashboard-page-header">
			<div className="dashboard-page-header__top">
				{backLink && (
					<a href={backLink.href} className="dashboard-page-header__back">
						&larr; {backLink.label}
					</a>
				)}
				{action && <div className="dashboard-page-header__action">{action}</div>}
			</div>
			<h1 className="dashboard-page-header__title">{title}</h1>
			{subtitle && <p className="dashboard-page-header__subtitle">{subtitle}</p>}
		</header>
	);
};

export default DashboardPageHeader;
