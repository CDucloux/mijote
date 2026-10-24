import { describe, it, expect } from "vitest";
import { socialPlatform, extractSocialCaption } from "../socialCaption.js";

describe("socialPlatform", () => {
  it("reconnaît Instagram et TikTok, sous-domaines compris", () => {
    expect(socialPlatform("https://www.instagram.com/reel/CDHMzITofWi/")).toBe("instagram");
    expect(socialPlatform("https://instagram.com/p/abc")).toBe("instagram");
    expect(socialPlatform("https://instagr.am/p/abc")).toBe("instagram");
    expect(socialPlatform("https://www.tiktok.com/@chef/video/123")).toBe("tiktok");
    expect(socialPlatform("https://vm.tiktok.com/ZMabc/")).toBe("tiktok");
  });

  it("ignore les sites ordinaires et les faux domaines", () => {
    expect(socialPlatform("https://www.marmiton.org/recettes/x.aspx")).toBeNull();
    expect(socialPlatform("https://notinstagram.com/reel/x")).toBeNull();
    expect(socialPlatform("https://instagram.com.evil.io/reel/x")).toBeNull();
  });

  it("renvoie null pour une URL invalide ou vide", () => {
    expect(socialPlatform("")).toBeNull();
    expect(socialPlatform("pas une url")).toBeNull();
  });
});

describe("extractSocialCaption", () => {
  it("retire l'en-tête Instagram (mentions, auteur, date) et les guillemets", () => {
    const html = `<meta property="og:description" content="1,234 likes, 56 comments - chef.lea on July 27, 2020: &quot;Tarte aux pommes&#10;- 3 pommes&#10;- 200 g de farine&quot;. ">`;
    expect(extractSocialCaption(html)).toBe("Tarte aux pommes\n- 3 pommes\n- 200 g de farine");
  });

  it("gère l'en-tête en français et les guillemets typographiques", () => {
    const html = `<meta property="og:description" content="1 234 J&#x2019;aime, 5 commentaires - chef.lea le 27 juillet 2020 : “Crêpes : 250 g de farine”">`;
    expect(extractSocialCaption(html)).toBe("Crêpes : 250 g de farine");
  });

  it("garde une légende TikTok sans en-tête telle quelle", () => {
    const html = `<meta name="description" content="Pâtes carbonara : 200 g de spaghetti, 2 jaunes d'oeuf">`;
    expect(extractSocialCaption(html)).toBe("Pâtes carbonara : 200 g de spaghetti, 2 jaunes d'oeuf");
  });

  it("préfère la balise la moins tronquée, quel que soit l'ordre des attributs", () => {
    const html = `<meta content="Courte…" property="og:description"><meta name='twitter:description' content='La recette complète, avec tous les ingrédients'>`;
    expect(extractSocialCaption(html)).toBe("La recette complète, avec tous les ingrédients");
  });

  it("renvoie une chaîne vide sans balise d'aperçu ou sur HTML vide", () => {
    expect(extractSocialCaption("<html><head><title>Instagram</title></head></html>")).toBe("");
    expect(extractSocialCaption("")).toBe("");
  });

  it("laisse intacte une entité inconnue ou hors plage", () => {
    const html = `<meta property="og:description" content="Sel &foo; poivre &#99999999;">`;
    expect(extractSocialCaption(html)).toBe("Sel &foo; poivre &#99999999;");
  });
});
