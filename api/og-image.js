import sharp from "sharp";
import { parseFirestoreDoc, isFetchableImageUrl, PREVIEW_IMAGE, MAX_SOURCE_BYTES } from "./_ogMeta.js";

// ─── VIGNETTE D'APERÇU (fonction Vercel) ─────────────────────────────────────
// Sert /api/og-image?id=<pubId> : la photo de la recette publique recadrée en
// 1200×630 (ratio 1,91:1 des aperçus de liens) et recompressée en JPEG léger.
// Sans ça, l'aperçu pointait vers la photo d'origine (ex. 2620×3332, 1,1 Mo) que
// WhatsApp ignore. N'accepte qu'un id de recette publique, jamais une URL : ce
// n'est pas un proxy d'images ouvert. Au moindre pépin, redirection vers le logo.
// Résultat mis en cache par le CDN (la photo d'une recette change rarement).

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

export default async function handler(req, res) {
  const raw = req.query?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const fallback = () => {
    res.setHeader("Cache-Control", "public, s-maxage=600");
    res.redirect(302, "/pwa-512.png");
  };
  if (!id || !PROJECT_ID) { fallback(); return; }

  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/publicRecipes/${encodeURIComponent(id)}`;
    const docResp = await fetch(docUrl, { signal: AbortSignal.timeout(4000) });
    if (!docResp.ok) { fallback(); return; }
    const image = parseFirestoreDoc(await docResp.json())?.image;
    if (!isFetchableImageUrl(image)) { fallback(); return; }

    const imgResp = await fetch(image, { signal: AbortSignal.timeout(6000) });
    const declared = Number(imgResp.headers.get("content-length") || 0);
    if (!imgResp.ok || declared > MAX_SOURCE_BYTES) { fallback(); return; }
    const source = Buffer.from(await imgResp.arrayBuffer());
    if (source.length > MAX_SOURCE_BYTES) { fallback(); return; }

    // `attention` centre le recadrage sur la zone la plus saillante (le plat).
    const out = await sharp(source)
      .rotate()
      .resize(PREVIEW_IMAGE.width, PREVIEW_IMAGE.height, { fit: "cover", position: "attention" })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    res.setHeader("Content-Type", PREVIEW_IMAGE.type);
    res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=2592000");
    res.status(200).send(out);
  } catch {
    fallback();
  }
}
