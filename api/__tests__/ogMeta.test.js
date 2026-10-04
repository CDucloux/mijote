import { describe, it, expect } from "vitest";
import {
  parseFirestoreDoc,
  buildShareMeta,
  injectMetaTags,
  previewImageUrl,
  isFetchableImageUrl,
  PREVIEW_IMAGE,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
} from "../_ogMeta.js";

const IMG = "https://firebasestorage.googleapis.com/v0/b/x/o/guac.jpg?alt=media";

// Document Firestore REST minimal réaliste (name/cuisine dénormalisés, image dans
// la map imbriquée `recipe`).
const doc = {
  name: "projects/p/databases/(default)/documents/publicRecipes/uid__guac",
  fields: {
    name: { stringValue: "Guacamole" },
    cuisine: { stringValue: "Mexicaine" },
    authorName: { stringValue: "Corentin" },
    recipe: {
      mapValue: {
        fields: {
          image: { stringValue: IMG },
          prepTime: { integerValue: "15" },
          cookTime: { integerValue: "0" },
        },
      },
    },
  },
};

describe("parseFirestoreDoc", () => {
  it("extrait nom, cuisine, image, durées et auteur", () => {
    expect(parseFirestoreDoc(doc)).toEqual({
      name: "Guacamole",
      cuisine: "Mexicaine",
      image: IMG,
      prepTime: 15,
      cookTime: 0,
      authorName: "Corentin",
    });
  });

  it("retombe sur l'image de la racine si absente de la map recipe", () => {
    const d = { fields: { name: { stringValue: "Tarte" }, image: { stringValue: IMG } } };
    expect(parseFirestoreDoc(d)?.image).toBe(IMG);
  });

  it("renvoie null si ni nom ni image", () => {
    expect(parseFirestoreDoc({ fields: { cuisine: { stringValue: "Thaï" } } })).toBeNull();
  });

  it("tolère un document malformé ou vide", () => {
    expect(parseFirestoreDoc(null)).toBeNull();
    expect(parseFirestoreDoc({})).toBeNull();
    expect(parseFirestoreDoc({ fields: null })).toBeNull();
    expect(parseFirestoreDoc("nope")).toBeNull();
  });

  it("ignore les chaînes vides (traitées comme absentes)", () => {
    const d = { fields: { name: { stringValue: "   " }, recipe: { mapValue: { fields: { image: { stringValue: IMG } } } } } };
    const r = parseFirestoreDoc(d);
    expect(r?.name).toBeNull();
    expect(r?.image).toBe(IMG);
  });
});

describe("buildShareMeta", () => {
  const opts = { pageUrl: "https://site/discover/uid__guac", fallbackImage: "https://site/pwa-512.png" };

  it("construit titre, description et image depuis la recette", () => {
    const m = buildShareMeta({ name: "Guacamole", image: IMG, cuisine: "Mexicaine", prepTime: 15, cookTime: 0 }, opts);
    expect(m.title).toBe("Guacamole · Cardamome");
    expect(m.image).toBe(IMG);
    expect(m.url).toBe(opts.pageUrl);
    expect(m.description).toContain("Cuisine mexicaine");
    expect(m.description).toContain("prête en 15 min");
    expect(m.description).toContain("Cardamome");
  });

  it("additionne prep + cook pour le temps total", () => {
    const m = buildShareMeta({ name: "Boeuf", image: IMG, cuisine: null, prepTime: 20, cookTime: 100 }, opts);
    expect(m.description).toContain("Prête en 120 min");
  });

  it("utilise l'image de repli quand la recette n'en a pas", () => {
    const m = buildShareMeta({ name: "Pain", image: null, cuisine: null, prepTime: null, cookTime: null }, opts);
    expect(m.image).toBe(opts.fallbackImage);
  });

  it("retombe sur les valeurs par défaut sans recette", () => {
    const m = buildShareMeta(null, opts);
    expect(m.title).toBe(DEFAULT_TITLE);
    expect(m.description).toBe(DEFAULT_DESCRIPTION);
    expect(m.image).toBe(opts.fallbackImage);
  });
});

describe("aperçu : vignette dédiée et auteur", () => {
  const opts = {
    pageUrl: "https://site/discover/uid__guac",
    fallbackImage: "https://site/pwa-512.png",
    previewImage: previewImageUrl("https://site", "uid__r1.55"),
  };

  it("parseFirestoreDoc lit l'auteur dénormalisé à la racine", () => {
    expect(parseFirestoreDoc(doc)?.authorName).toBe("Corentin");
  });

  it("pointe l'aperçu vers la vignette 1200×630 et en déclare les dimensions", () => {
    const m = buildShareMeta({ name: "Guacamole", image: IMG, cuisine: null, prepTime: null, cookTime: null }, opts);
    expect(m.image).toBe("https://site/api/og-image?id=uid__r1.55");
    expect(m.imageSize).toEqual(PREVIEW_IMAGE);
  });

  it("garde le logo de repli, sans dimensions, quand la recette n'a pas de photo", () => {
    const m = buildShareMeta({ name: "Pain", image: null, cuisine: null, prepTime: null, cookTime: null }, opts);
    expect(m.image).toBe(opts.fallbackImage);
    expect(m.imageSize).toBeNull();
  });

  it("ouvre la description sur l'auteur", () => {
    const m = buildShareMeta({ name: "Guacamole", image: IMG, cuisine: "Mexicaine", prepTime: 15, cookTime: 0, authorName: "Corentin" }, opts);
    expect(m.description).toBe("Une recette de Corentin · cuisine mexicaine · prête en 15 min · à découvrir sur Cardamome.");
  });

  it("encode l'id dans l'URL de la vignette", () => {
    expect(previewImageUrl("https://site", "a b/c")).toBe("https://site/api/og-image?id=a%20b%2Fc");
  });
});

describe("isFetchableImageUrl", () => {
  it("accepte uniquement les URL http(s) absolues", () => {
    expect(isFetchableImageUrl(IMG)).toBe(true);
    expect(isFetchableImageUrl("http://blog.fr/plat.jpg")).toBe(true);
    expect(isFetchableImageUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isFetchableImageUrl("file:///etc/passwd")).toBe(false);
    expect(isFetchableImageUrl("/images/plat.jpg")).toBe(false);
    expect(isFetchableImageUrl("")).toBe(false);
    expect(isFetchableImageUrl(null)).toBe(false);
  });
});

describe("injectMetaTags", () => {
  const baseHtml = `<!doctype html><html><head>
<title>Cardamome, donne du caractère à tes recettes</title>
<meta name="description" content="desc statique" />
<meta property="og:title" content="Cardamome" />
<meta property="og:description" content="og desc" />
<meta property="og:url" content="https://cardamome.studio/" />
<meta property="og:image" content="https://cardamome.studio/pwa-512.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="512" />
<meta property="og:image:height" content="512" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="Cardamome" />
<meta name="twitter:description" content="tw desc" />
<meta name="twitter:image" content="https://cardamome.studio/pwa-512.png" />
</head><body></body></html>`;

  const meta = { title: "Guacamole · Cardamome", description: "Cuisine mexicaine.", image: IMG, url: "https://site/discover/x" };

  it("réécrit titre, description, og et twitter", () => {
    const out = injectMetaTags(baseHtml, meta);
    expect(out).toContain("<title>Guacamole · Cardamome</title>");
    expect(out).toContain('<meta name="description" content="Cuisine mexicaine." />');
    expect(out).toContain(`<meta property="og:title" content="Guacamole · Cardamome" />`);
    expect(out).toContain(`<meta property="og:image" content="${IMG}" />`);
    expect(out).toContain(`<meta name="twitter:image" content="${IMG}" />`);
    expect(out).toContain(`<meta property="og:url" content="https://site/discover/x" />`);
  });

  it("passe la carte Twitter en summary_large_image", () => {
    expect(injectMetaTags(baseHtml, meta)).toContain(`<meta name="twitter:card" content="summary_large_image" />`);
  });

  it("retire les dimensions/type du logo carré", () => {
    const out = injectMetaTags(baseHtml, meta);
    expect(out).not.toContain("og:image:width");
    expect(out).not.toContain("og:image:height");
    expect(out).not.toContain("og:image:type");
  });

  it("remplace les dimensions du logo par celles de la vignette quand elles sont fournies", () => {
    const out = injectMetaTags(baseHtml, { ...meta, imageSize: PREVIEW_IMAGE });
    expect(out).toContain(`<meta property="og:image:width" content="1200" />`);
    expect(out).toContain(`<meta property="og:image:height" content="630" />`);
    expect(out).toContain(`<meta property="og:image:type" content="image/jpeg" />`);
  });

  it("échappe les guillemets et esperluettes dans les valeurs", () => {
    const out = injectMetaTags(baseHtml, { title: `Riz "façon" thaï & co`, description: "a & b", image: IMG, url: "u" });
    expect(out).toContain(`<meta property="og:title" content="Riz &quot;façon&quot; thaï &amp; co" />`);
    expect(out).not.toContain(`content="Riz "façon"`);
  });

  it("ne casse pas un HTML dépourvu des balises (no-op ciblé)", () => {
    const out = injectMetaTags("<html><head></head></html>", meta);
    expect(out).toBe("<html><head></head></html>");
  });
});
