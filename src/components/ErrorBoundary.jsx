import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App crashed:", error, info?.componentStack);
  }

  handleReload = () => {
    try {
      this.setState({ error: null });
      if (typeof window !== "undefined") window.location.reload();
    } catch {
      /* noop */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message || String(this.state.error || "Errore sconosciuto");

    return (
      <div className="min-h-full bg-[#1a1a2e] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-soft-lg p-6 text-center fade-in">
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="text-xl font-extrabold text-ink mb-1">Qualcosa è andato storto</h1>
          <p className="text-sm text-ink/60 mb-4">
            L'app ha incontrato un errore imprevisto. I tuoi dati sono al sicuro nel dispositivo.
          </p>
          <pre className="text-[11px] text-left text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 max-h-40 overflow-auto whitespace-pre-wrap break-words">
            {message}
          </pre>
          <button
            onClick={this.handleReload}
            className="h-11 px-5 rounded-xl bg-ink text-white font-semibold active:scale-[0.98] shadow-soft"
          >
            Ricarica l'app
          </button>
        </div>
      </div>
    );
  }
}
