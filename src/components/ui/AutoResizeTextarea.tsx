import { useRef, useEffect } from "react";
import type { ChangeEventHandler, CSSProperties } from "react";

interface AutoResizeTextareaProps {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
}

// Textarea qui grandit avec son contenu (pas de scroll interne, pas de resize manuel).
export function AutoResizeTextarea({ value, onChange, placeholder, className, style }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
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
