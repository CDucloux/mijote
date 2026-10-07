import { describe, it, expect } from "vitest";
import { parseYoutubeVideoId, parseYoutubeSnippet, cleanYoutubeDescription, looksLikeRecipe, youtubeRecipeText } from "../youtube.js";

// Description réelle (Beef Bourguignon, https://youtu.be/dBG8JMIT09g) : sponsor et
// matériel en tête, liste d'ingrédients sans intertitre, étapes non numérotées.
const BOURGUIGNON = [
  "@hestanuk_eu. Use code ADAMBYATT15 for 15% off - They're the only pans I would recommend whole heartedly. Lifetime warranty.",
  "",
  "https://hestanculinary.co.uk/collections/probond",
  "",
  "For this, I used the Hestan ProBond Luxe 30cm Polished Professional Clad Stainless Steel Rondeau - 5.7L 35% more conductivity than a normal clad pan as well as the Hestan CopperBond Induction Copper Sautéuse & Lid - 26cm (3.3L).",
  "",
  "Makes enough for four people.",
  "",
  "Beef Bourguignon",
  "200g large bacon lardons diced \u2013 I have used ventreche",
  "12 chestnut mushrooms, turned if you wish..",
  "12 silverskin onions, peeled",
  "2 beef cheeks, large dice",
  "1 carrot, peeled, large dice",
  "1 onion, peeled, large dice",
  "1 stick celery, large dice",
  "1 bulb garlic, split",
  "1 small bunch thyme",
  "Plain Flour, for dusting",
  "1 bottle Burgundian pinot noir red wine/75cl",
  "Double-brown chicken stock, as required - around 1ltr",
  "1 bunch flat-leaf parsley, chopped",
  "Maldon salt",
  "Black pepper",
  "Oil, as required",
  "-",
  "Render the bacon lardons in a heavy braising pan until deeply browned and crisp, allowing the fat to render out.",
  "Add the red wine \u2014 approximately 750ml\u20131L \u2014 and reduce rapidly, but do not reduce completely to syrup.",
  "Braise at 155\u2013160°C for approximately 3 hours, until the beef is completely tender but still holds its shape.",
  "Serve with pommes duchesse or mashed potato.",
].join("\n");

describe("parseYoutubeVideoId", () => {
  it("reconnaît le lien court de partage, paramètres annexes compris", () => {
    expect(parseYoutubeVideoId("https://youtu.be/dBG8JMIT09g?is=Ml-c3OhqbojZa7gg")).toBe("dBG8JMIT09g");
    expect(parseYoutubeVideoId("https://youtu.be/dBG8JMIT09g")).toBe("dBG8JMIT09g");
  });
  it("reconnaît les pages de lecture, Shorts, lives et lecteurs intégrés", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=dBG8JMIT09g&t=42s")).toBe("dBG8JMIT09g");
    expect(parseYoutubeVideoId("https://m.youtube.com/watch?feature=share&v=dBG8JMIT09g")).toBe("dBG8JMIT09g");
    expect(parseYoutubeVideoId("https://youtube.com/shorts/dBG8JMIT09g?si=abc")).toBe("dBG8JMIT09g");
    expect(parseYoutubeVideoId("https://www.youtube.com/live/dBG8JMIT09g")).toBe("dBG8JMIT09g");
    expect(parseYoutubeVideoId("https://www.youtube-nocookie.com/embed/dBG8JMIT09g")).toBe("dBG8JMIT09g");
  });
  it("renvoie null pour tout ce qui n'est pas une vidéo YouTube", () => {
    expect(parseYoutubeVideoId("https://www.marmiton.org/recettes/boeuf.aspx")).toBeNull();
    expect(parseYoutubeVideoId("https://www.youtube.com/@AdamByatt")).toBeNull();
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=trop-court")).toBeNull();
    expect(parseYoutubeVideoId("https://evil.com/youtu.be/dBG8JMIT09g")).toBeNull();
    expect(parseYoutubeVideoId("https://notyoutube.com/watch?v=dBG8JMIT09g")).toBeNull();
    expect(parseYoutubeVideoId("pas une url")).toBeNull();
    expect(parseYoutubeVideoId("")).toBeNull();
  });
});

describe("parseYoutubeSnippet", () => {
  const payload = (snippet: unknown) => ({ items: [{ id: "dBG8JMIT09g", snippet }] });

  it("extrait titre, description et la plus grande miniature disponible", () => {
    const snippet = parseYoutubeSnippet(payload({
      title: "  Beef Bourguignon  ",
      description: BOURGUIGNON,
      thumbnails: { high: { url: "https://i.ytimg.com/vi/x/hqdefault.jpg" }, maxres: { url: "https://i.ytimg.com/vi/x/maxresdefault.jpg" } },
    }));
    expect(snippet).toEqual({ title: "Beef Bourguignon", description: BOURGUIGNON, thumbnail: "https://i.ytimg.com/vi/x/maxresdefault.jpg" });
  });
  it("retombe sur une miniature plus petite et ignore les URLs non https", () => {
    const snippet = parseYoutubeSnippet(payload({ title: "T", description: "", thumbnails: { maxres: { url: "javascript:alert(1)" }, medium: { url: "https://i.ytimg.com/vi/x/mq.jpg" } } }));
    expect(snippet?.thumbnail).toBe("https://i.ytimg.com/vi/x/mq.jpg");
  });
  it("tolère des champs manquants ou mal typés", () => {
    expect(parseYoutubeSnippet(payload({ title: 42, description: null }))).toEqual({ title: "", description: "", thumbnail: "" });
  });
  it("renvoie null pour une vidéo absente (privée, supprimée) ou une réponse malformée", () => {
    expect(parseYoutubeSnippet({ items: [] })).toBeNull();
    expect(parseYoutubeSnippet({ items: [{ id: "x" }] })).toBeNull();
    expect(parseYoutubeSnippet({ error: { code: 403 } })).toBeNull();
    expect(parseYoutubeSnippet(null)).toBeNull();
    expect(parseYoutubeSnippet("oops")).toBeNull();
  });
});

describe("cleanYoutubeDescription", () => {
  it("retire les liens, chapitres horodatés et lignes de hashtags", () => {
    const raw = "Ma recette :\r\nhttps://monblog.fr/recette\n0:00 Intro\n(1:23) Le dressage\n1:02:03 Fin\n#cuisine #recette\n\n\n\n200 g de farine";
    expect(cleanYoutubeDescription(raw)).toBe("Ma recette :\n\n200 g de farine");
  });
  it("garde intactes les lignes de recette", () => {
    const cleaned = cleanYoutubeDescription(BOURGUIGNON);
    expect(cleaned).toContain("200g large bacon lardons diced");
    expect(cleaned).toContain("Braise at 155\u2013160°C");
    expect(cleaned).not.toContain("https://");
  });
  it("gère une description vide", () => {
    expect(cleanYoutubeDescription("")).toBe("");
  });
});

describe("looksLikeRecipe", () => {
  it("détecte la liste d'ingrédients d'une vraie description, même sans intertitre", () => {
    expect(looksLikeRecipe(cleanYoutubeDescription(BOURGUIGNON))).toBe(true);
  });
  it("accepte un intertitre « Ingrédients » avec une seule ligne de quantité", () => {
    expect(looksLikeRecipe("Ingrédients\n2 œufs\nsel, poivre")).toBe(true);
    expect(looksLikeRecipe("INGREDIENTS:\n- 1/2 cup flour")).toBe(true);
  });
  it("rejette une description sans recette (résumé, renvoi vers un blog, chapitres)", () => {
    expect(looksLikeRecipe("Aujourd'hui je vous montre mon bœuf bourguignon !\nLa recette est sur mon blog.")).toBe(false);
    expect(looksLikeRecipe(cleanYoutubeDescription("0:00 Intro\n1:30 Cuisson\n5:00 Dégustation"))).toBe(false);
    expect(looksLikeRecipe("")).toBe(false);
  });
});

describe("youtubeRecipeText", () => {
  it("place le titre de la vidéo avant la description nettoyée", () => {
    const text = youtubeRecipeText({ title: "Beef Bourguignon", description: "https://x.y\n200g lardons", thumbnail: "" });
    expect(text).toBe("Titre de la vidéo : Beef Bourguignon\n\n200g lardons");
  });
  it("se contente de la description quand le titre manque, et borne la longueur", () => {
    expect(youtubeRecipeText({ title: "", description: "1 oignon", thumbnail: "" })).toBe("1 oignon");
    expect(youtubeRecipeText({ title: "T", description: "a".repeat(20_000), thumbnail: "" }).length).toBe(8_000);
  });
});
