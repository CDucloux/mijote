// Titre de section « fantôme » (barre courte à la place de « Carnets »/« Recettes »).
function SectionTitleSkeleton({ width }: { width: number }) {
  return <div className="skeleton" style={{ height: 15, width, borderRadius: 6, marginBottom: 12 }} />;
}

// Rangée de carnets « fantômes » (forme livre : page carrée + tranche blanche).
function NotebooksSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: "flex", gap: 14, overflow: "hidden", padding: "7px 3px 8px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 134, borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
          <div className="skeleton" style={{ aspectRatio: "1/1" }} />
          <div style={{ padding: "9px 11px 12px", background: "var(--surface)" }}>
            <div className="skeleton" style={{ height: 11, width: "78%", borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 8, width: "46%", borderRadius: 5, marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Grille de cartes « fantômes », calquée sur la vraie grille (image 16/10 + méta).
function RecipeGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--surface)", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)" }}>
          <div className="skeleton" style={{ width: "100%", aspectRatio: "16/10" }} />
          <div style={{ padding: "10px 12px 12px" }}>
            <div className="skeleton" style={{ height: 11, width: "85%", borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 9, width: "55%", borderRadius: 5, marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Squelette de la bibliothèque : rangée de carnets puis grille de recettes. */
export function LibrarySkeleton() {
  return (
    <>
      <SectionTitleSkeleton width={96} />
      <NotebooksSkeleton />
      <div style={{ marginTop: 22 }}>
        <SectionTitleSkeleton width={116} />
        <RecipeGridSkeleton />
      </div>
    </>
  );
}
