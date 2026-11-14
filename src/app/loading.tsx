export default function Loading() {
  return (
    <main className="app-loading" aria-busy="true">
      <div className="app-loading-card">
        <span className="app-loading-spinner" aria-hidden="true" />
        <p role="status">Carregando conteúdo…</p>
      </div>
    </main>
  );
}
