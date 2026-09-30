// Rendu inline minimal du Markdown : **gras**, *italique*, `code`.
// Utilisé pour la changelog et le bandeau de nouveautés.
export function renderInline(text) {
  const parts = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0, m, key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={key++} style={{ fontWeight: 600, color: "var(--text)" }}>{m[1]}</strong>);
    else if (m[2]) parts.push(<em key={key++}>{m[2]}</em>);
    else if (m[3]) parts.push(<code key={key++} style={{ fontFamily: "monospace", fontSize: "0.92em", background: "var(--surface2)", borderRadius: 4, padding: "1px 5px" }}>{m[3]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
