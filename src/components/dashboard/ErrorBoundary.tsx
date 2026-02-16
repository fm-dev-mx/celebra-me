import React, { Component, type ReactNode } from 'react';

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
	errorInfo?: React.ErrorInfo;
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
		console.error('[ErrorBoundary] Caught error:', error, errorInfo);
		this.setState({ errorInfo });
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div
					className="dashboard-error-boundary"
					style={{ padding: '2rem', textAlign: 'center' }}
				>
					<h3>Algo salió mal</h3>
					<p>Ocurrió un error al cargar este componente.</p>
					{this.state.error && (
						<details
							className="dashboard-error-details"
							style={{ marginTop: '1rem', textAlign: 'left' }}
						>
							<summary>Detalles del error</summary>
							<pre
								style={{ fontSize: '0.8rem', overflow: 'auto', maxHeight: '200px' }}
							>
								{this.state.error.message}
								{this.state.error.stack && (
									<>
										{'\n\nStack:'}
										{this.state.error.stack}
									</>
								)}
								{this.state.errorInfo?.componentStack && (
									<>
										{'\n\nComponent Stack:'}
										{this.state.errorInfo.componentStack}
									</>
								)}
							</pre>
						</details>
					)}
					<button
						type="button"
						onClick={() =>
							this.setState({
								hasError: false,
								error: undefined,
								errorInfo: undefined,
							})
						}
						style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
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
