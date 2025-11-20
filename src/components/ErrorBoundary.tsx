import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#000a14',
                    color: '#e0e1dd',
                    fontFamily: 'sans-serif',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <h1 style={{ color: '#ef233c', marginBottom: '1rem' }}>Algo deu errado</h1>
                    <p style={{ marginBottom: '2rem', maxWidth: '600px' }}>
                        Ocorreu um erro ao carregar a aplicação. Isso geralmente acontece por problemas de configuração.
                    </p>
                    <div style={{
                        backgroundColor: '#1b263b',
                        padding: '1rem',
                        borderRadius: '8px',
                        textAlign: 'left',
                        maxWidth: '800px',
                        overflow: 'auto'
                    }}>
                        <code style={{ color: '#bca36f' }}>
                            {this.state.error?.message}
                        </code>
                    </div>
                    <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#778da9' }}>
                        Verifique se o arquivo .env está configurado corretamente com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
