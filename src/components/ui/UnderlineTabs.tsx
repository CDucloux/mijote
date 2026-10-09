import { useLayoutEffect, useRef, useState } from "react";
import { OverscrollRow } from "./OverscrollRow.jsx";

export interface UnderlineTab<T> {
  value: T;
  label: string;
  /** Effectif affiché à côté du libellé (omis si absent). */
  count?: number;
}

interface UnderlineTabsProps<T> {
  tabs: UnderlineTab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nom accessible du groupe d'onglets. */
  label: string;
}

// Onglets texte soulignés : un trait d'accent glisse sous l'onglet actif (mesuré
// dans la rangée, donc juste même quand celle-ci défile horizontalement).
export function UnderlineTabs<T>({ tabs, value, onChange, label }: UnderlineTabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = tabs.findIndex(t => t.value === value);

  useLayoutEffect(() => {
    const el = refs.current[activeIndex];
    if (!el) { setBar(null); return; }
    setBar({ left: el.offsetLeft, width: el.offsetWidth });
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeIndex, tabs]);

  return (
    <OverscrollRow stretch outerStyle={{ borderBottom: "1px solid var(--border)" }} style={{ position: "relative", gap: 22 }}>
      <div role="tablist" aria-label={label} style={{ display: "contents" }}>
        {tabs.map((tab, i) => {
          const on = i === activeIndex;
          return (
            <button key={tab.label} ref={el => { refs.current[i] = el; }} role="tab" aria-selected={on} onClick={() => onChange(tab.value)}
              style={{ flexShrink: 0, display: "flex", alignItems: "baseline", gap: 6, padding: "8px 0 11px", background: "none", border: "none", cursor: "pointer",
                fontSize: 13.5, fontWeight: on ? 650 : 500, color: on ? "var(--text)" : "var(--text2)", transition: "color 0.18s ease" }}>
              {tab.label}
              {tab.count != null && (
                <span style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: on ? "var(--accent)" : "var(--text3)", transition: "color 0.18s ease" }}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {bar && (
        <span aria-hidden style={{ position: "absolute", bottom: -1, left: 0, height: 2.5, borderRadius: 2, background: "var(--accent)",
          width: bar.width, transform: `translateX(${bar.left}px)`, transition: "transform 0.28s cubic-bezier(.3,.9,.3,1), width 0.28s cubic-bezier(.3,.9,.3,1)" }} />
      )}
    </OverscrollRow>
  );
}
