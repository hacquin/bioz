import React from 'react';

// Garde-fou global : empêche qu'une erreur de rendu d'une seule carte fasse
// tomber TOUTE l'app (écran blanc + reload). On affiche l'erreur et un bouton
// de rechargement au lieu d'une page vide.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[BIOZ] Erreur de rendu interceptée :', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold">Une erreur est survenue</h1>
          <p className="text-sm text-slate-400 max-w-md">
            L'affichage a rencontré un problème. Vos données sont en sécurité.
          </p>
          <pre className="text-[10px] text-slate-500 max-w-md overflow-auto whitespace-pre-wrap">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-4 py-2 rounded-lg text-sm"
          >
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
