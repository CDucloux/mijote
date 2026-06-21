import { useRef, useEffect } from "react";

// ─── AUTO-RESIZE TEXTAREA ─────────────────────────────────────────────────────
export function AutoResizeTextarea({ value, onChange, placeholder, className, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea ref={ref} className={className} placeholder={placeholder} value={value} onChange={onChange}
      style={{ resize: "none", overflow: "hidden", minHeight: 76, ...style }} />
  );
}
