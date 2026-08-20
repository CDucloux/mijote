import { describe, it, expect } from "vitest";
import {
  parseFirestoreDoc,
  buildShareMeta,
  injectMetaTags,
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
  it("extrait nom, cuisine, image et durées", () => {
    expect(parseFirestoreDoc(doc)).toEqual({
      name: "Guacamole",
      cuisine: "Mexicaine",
      image: IMG,
      prepTime: 15,
      cookTime: 0,
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
    expect(m.description).toContain("prêt en 15 min");
    expect(m.description).toContain("Cardamome");
  });

  it("additionne prep + cook pour le temps total", () => {
    const m = buildShareMeta({ name: "Boeuf", image: IMG, cuisine: null, prepTime: 20, cookTime: 100 }, opts);
    expect(m.description).toContain("Prêt en 120 min");
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

describe("injectMetaTags", () => {
  const baseHtml = `<!doctype html><html><head>
<title>Cardamome, l'atelier de tes recettes</title>
<meta name="description" content="desc statique" />
<meta property="og:title" content="Cardamome" />
<meta property="og:description" content="og desc" />
<meta property="og:url" content="https://mijote-sand.vercel.app/" />
<meta property="og:image" content="https://mijote-sand.vercel.app/pwa-512.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="512" />
<meta property="og:image:height" content="512" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="Cardamome" />
<meta name="twitter:description" content="tw desc" />
<meta name="twitter:image" content="https://mijote-sand.vercel.app/pwa-512.png" />
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
