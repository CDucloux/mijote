// Import sans extension : la fonction est bundlée par esbuild (@vercel/node), qui
// résout ../src/lib/share/ogMeta vers le .ts (extensions par défaut). La logique
// pure vit et est testée dans src/lib ; ici, uniquement l'I/O.
import { parseFirestoreDoc, buildShareMeta, injectMetaTags } from "../src/lib/share/ogMeta";

// ─── OPEN GRAPH SSR (fonction Vercel) ────────────────────────────────────────
// Rendu côté serveur des balises de partage pour /discover/:id. Les crawlers de
// liens (WhatsApp, iMessage, Discord...) n'exécutent pas de JS : sans ceci, ils ne
// voient que les balises statiques d'index.html (logo générique). Ici on récupère
// l'index.html buildé, on lit la recette publique via l'API REST Firestore (lecture
// publique autorisée par firestore.rules), et on réécrit les balises avec l'image /
// le titre de la recette. Les vrais navigateurs reçoivent la même page (l'app boote
// normalement) ; seuls les <meta> changent. Dégradation gracieuse : au moindre
// pépin, on sert l'index.html tel quel.
//
// Le projectId vient de la variable d'env déjà présente sur Vercel pour le build
// client (VITE_FIREBASE_PROJECT_ID), disponible ici via process.env. Aucun secret.

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

export default async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const origin = `${proto}://${host}`;
  const raw = req.query?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  const serve = (body) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(body);
  };

  let html;
  try {
    html = await fetch(`${origin}/index.html`).then((r) => r.text());
  } catch {
    res.status(502).send("Service indisponible");
    return;
  }

  if (!id || !PROJECT_ID) { serve(html); return; }

  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/publicRecipes/${encodeURIComponent(id)}`;
    const resp = await fetch(docUrl);
    if (!resp.ok) { serve(html); return; }
    const fields = parseFirestoreDoc(await resp.json());
    const meta = buildShareMeta(fields, {
      pageUrl: `${origin}/discover/${encodeURIComponent(id)}`,
      fallbackImage: `${origin}/pwa-512.png`,
    });
    serve(injectMetaTags(html, meta));
  } catch {
    serve(html);
  }
}
