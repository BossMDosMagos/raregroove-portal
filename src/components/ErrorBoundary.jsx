import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              Ops! Algo deu errado.
            </h1>
            
            <p className="text-white/60 text-sm">
              Ocorreu um erro inesperado. Nossa equipe técnica já foi notificada.
            </p>

            <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-left overflow-auto max-h-40 text-xs font-mono text-red-400">
              {this.state.error && this.state.error.toString()}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-xl hover:bg-[#D4AF37]/90 transition-all uppercase tracking-widest text-xs"
            >
              Tentar Novamente
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-white/5 text-white font-black py-4 rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
