import { useState, useEffect } from "react";

export function useLS(key, def) {
  const [val, setVal] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota */ } }, [key, val]);
  return [val, setVal];
}
