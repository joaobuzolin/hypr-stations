import ErrorBoundary from '../shared/ErrorBoundary';
import Header from '../shared/Header';
import TvMap from './TvMap';

export default function TvPage() {
  return (
    <div className="h-screen flex flex-col">
      <Header currentPage="/tv" showAuth={false} />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <h1 className="sr-only">TV Map — Emissoras de TV digital e retransmissoras do Brasil</h1>
        <ErrorBoundary>
          <TvMap />
        </ErrorBoundary>
      </main>
    </div>
  );
}
