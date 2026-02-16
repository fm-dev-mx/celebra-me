import React, { Component, type ReactNode } from 'react';

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error('ErrorBoundary caught an error:', error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="dashboard-error-boundary">
					<h3>Algo salió mal</h3>
					<p>Ocurrió un error al cargar este componente.</p>
					{this.state.error && (
						<details className="dashboard-error-details">
							<summary>Detalles del error</summary>
							<pre>{this.state.error.message}</pre>
						</details>
					)}
					<button
						type="button"
						onClick={() => this.setState({ hasError: false, error: undefined })}
					>
						Reintentar
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}

export function withErrorBoundary<P extends object>(
	Component: React.ComponentType<P>,
	fallback?: ReactNode,
): React.ComponentType<P> {
	return function WrappedComponent(props: P) {
		return (
			<ErrorBoundary fallback={fallback}>
				<Component {...props} />
			</ErrorBoundary>
		);
	};
}
