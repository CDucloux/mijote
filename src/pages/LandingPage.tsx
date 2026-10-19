import { useEffect, useRef, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { ThemeToggle } from "../components/ui/ThemeToggle.jsx";
import { LogoPod } from "../components/ui/LogoPod.jsx";
import { FridgeScene } from "../components/landing/FridgeScene.jsx";
import { ImportScene } from "../components/landing/ImportScene.jsx";
import { PhoneFrame, SceneChosen, SceneCardPile, SceneBooks, SceneEditor } from "../components/landing/LandingScenes.jsx";
import { StoreButtons, LandingFooter } from "../components/landing/LandingBrands.jsx";
import { ProofsSection, OfferSection } from "../components/landing/LandingOffer.jsx";
import { landingPrimaryCta } from "@/lib/landing/cta.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import "../styles/landing.css";

// ─── LANDING PUBLIQUE (route /) ───────────────────────────────────────────────
// Manifeste éditorial ponctué de preuves produit. Aucune donnée inventée : chaque
// affirmation s'appuie sur une capacité réellement présente (voir README). La
// logique consciente de l'auth (libellé + cible du CTA) vit dans src/lib/landing.
//
// Les visuels « app » (scènes ci-dessous) ne sont PAS des captures : ce sont des
// maquettes vivantes bâties sur les mêmes tokens de design que l'app (accent, oak,
// wall, spice, ff-display/ff-hand…) et sur les mêmes composants (carte recette,
// écran d'accueil), donc fidèles au produit, theme-aware, sans aucun asset externe
// ni image générée. Elles montrent l'app sans rien inventer.

// Ancres de la barre de navigation : sauts vers les sections clés. Peu nombreuses,
// pour rester lisibles et ne pas transformer la nav en menu fourre-tout.
const NAV_LINKS = [
  { label: "Le problème", id: "probleme" },
  { label: "Les fonctionnalités", id: "fonctionnalites" },
  { label: "L'offre", id: "offre" },
];

interface LandingPageProps {
  /** Utilisateur connecté, s'il y en a un : il décide de la cible du CTA principal. */
  user: Parameters<typeof landingPrimaryCta>[0];
  isDark: boolean;
  toggleTheme: () => void;
}

/**
 * Landing publique servie sur `/`. Reste consultable connecté ou non : le CTA
 * principal garde un libellé unique (« Découvrir Cardamome »), seule sa destination
 * s'adapte à l'auth. Aucun accès Firestore ni logique métier ici, c'est une page de
 * présentation pure.
 *
 */
export function LandingPage({ user, isDark, toggleTheme }: LandingPageProps) {
  const navigate = useNavigate();
  const primary = landingPrimaryCta(user);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Overscroll élastique en bas de page (mobile), comme dans l'app. Désactivé sur
  // desktop, où c'est la fenêtre qui défile (cf. .lp-root en hauteur de contenu).
  // Le conteneur scrollable est .lp-root (partagé avec rootRef via setRoot) ; seul
  // le contenu défilant est étiré (contentRef), la barre et le chevron fixes restent
  // hors de la transformation pour ne pas casser leur `position: fixed`.
  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useElasticScroll<HTMLDivElement>({ disabled: isDesktop });
  const setRoot = (el: HTMLDivElement | null) => { rootRef.current = el; scrollRef.current = el; };

  const scrollToId = (id: string) => (e?: MouseEvent) => {
    e?.preventDefault?.();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Le conteneur qui défile dépend du gabarit : .lp-root lui-même sur mobile, un
  // ancêtre sur desktop (body en overflow:auto, pas la fenêtre). scrollTo couvre le
  // premier, scrollIntoView remonte n'importe quel ancêtre défilant pour le second.
  const scrollTop = (e?: MouseEvent) => {
    e?.preventDefault?.();
    rootRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // Chevron « suivant » : un SEUL bouton flottant (position fixe), toujours au même
  // endroit à l'écran (les slides n'ont pas exactement la même hauteur, un bouton
  // par slide tombait donc à des positions légèrement différentes). Il descend vers
  // la première section dont le haut est encore sous le haut du viewport.
  const nextRef = useRef<HTMLButtonElement>(null);
  const goNext = () => {
    const secs = rootRef.current?.querySelectorAll<HTMLElement>("section.lp-slide");
    if (!secs) return;
    for (const s of secs) {
      if (s.getBoundingClientRect().top > 8) {
        s.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
  };
  // Masque le chevron une fois la dernière slide atteinte (getBoundingClientRect
  // suffit : indépendant du conteneur de défilement, window ou .lp-root).
  useEffect(() => {
    const secs = rootRef.current?.querySelectorAll("section.lp-slide");
    const last = secs && secs[secs.length - 1];
    const btn = nextRef.current;
    if (!last || !btn) return;
    const io = new IntersectionObserver(
      ([entry]) => btn.classList.toggle("lp-next--hidden", entry.isIntersecting),
      { threshold: 0.4 },
    );
    io.observe(last);
    return () => io.disconnect();
  }, []);

  // Fonctions de rendu (et non composants déclarés au render) : CTA et marque
  // apparaissent plusieurs fois. On factorise sans remonter de sous-composant qui
  // réinitialiserait un état à chaque render.
  const primaryCta = (small = false) => (
    <button className={`lp-cta${small ? " lp-cta--sm" : ""}`} onClick={() => navigate(primary.to)}>
      {primary.label}
      <Icon name="forward" size={small ? 15 : 17} color="#fff" />
    </button>
  );
  const brand = (size = 27) => (
    <a href="#top" className="lp-brandmark" onClick={scrollTop} aria-label="Cardamome, revenir en haut">
      <LogoPod size={size} />
      <span className="lp-brand">Cardam<span className="lp-brand__dot">o</span>me<span className="lp-brand__dot">·</span></span>
    </a>
  );

  return (
    <div className="lp-root" id="top" ref={setRoot}>
      {/* Barre de navigation : PRÉSENTE sur toutes les slides. Fixe en haut, le
          contenu défile dessous. Marque + ancres (#) + thème + CTA. */}
      <header className="lp-navbar">
        <div className="lp-wrap lp-navbar__inner">
          {brand(24)}
          <nav className="lp-navbar__links">
            {NAV_LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`} onClick={scrollToId(l.id)}>{l.label}</a>
            ))}
          </nav>
          <div className="lp-nav__right">
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} className="lp-theme" />
            {primaryCta(true)}
          </div>
        </div>
      </header>

      {/* Chevron « suivant » unique et flottant : position fixe, donc toujours au
          même endroit à l'écran quelle que soit la hauteur de la slide courante. */}
      <button ref={nextRef} className="lp-next" onClick={goNext} aria-label="Section suivante">
        <Icon name="chevronDown" size={20} />
      </button>

      {/* Contenu défilant (étiré par l'overscroll élastique). La barre et le chevron
          fixes restent hors de ce bloc pour garder leur `position: fixed` intacte. */}
      <div ref={contentRef}>
      {/* 1. Coup de poing */}
      <section className="lp-wrap lp-hero lp-slide">
        <div className="lp-hero__grid">
          <div className="lp-hero__copy">
            <h1 className="lp-hero__title">Les apps de recettes sont devenues des poubelles.</h1>
            <p className="lp-hero__lede">
              Des milliers de recettes. Des doublons. Du contenu moyen. Et toi, toujours planté
              devant ton frigo à te demander <strong>quoi faire à manger</strong>.
            </p>
            <p className="lp-hero__note">Avec Cardamome, on a décidé de faire autrement.</p>
            <div className="lp-hero__actions lp-cta-row">
              <StoreButtons />
            </div>
          </div>
          <div className="lp-hero__art">
            <FridgeScene />
          </div>
        </div>
      </section>

      {/* 2. Situation vécue */}
      <section id="probleme" className="lp-wrap lp-section lp-slide">
        <div className="lp-split lp-split--reverse">
          <div className="lp-split__media">
            <SceneCardPile />
          </div>
          <div>
            <span className="lp-eyebrow">Le vrai problème</span>
            <h2 className="lp-h2 lp-h2--wide">Le problème n'est pas le manque de recettes.</h2>
            <p className="lp-p">
              Tu n'en as jamais manqué. Tu croules dessous. Des captures d'écran. Des liens que tu
              t'envoies à toi-même. Vingt onglets ouverts. Des favoris que tu ne rouvriras jamais.
            </p>
            <p className="lp-punch">
              Ajouter du contenu n'a jamais aidé personne à cuisiner. Ça remplit une base de données,
              <em> pas une assiette.</em>
            </p>
          </div>
        </div>
      </section>

      {/* 3. Tes livres */}
      <section id="lp-livres" className="lp-wrap lp-section lp-slide">
        <div className="lp-split">
          <div>
            <span className="lp-eyebrow">Tes livres</span>
            <h2 className="lp-h2 lp-h2--wide">Tu as 15 livres de cuisine. Tu les aimes.</h2>
            <p className="lp-p">
              Nous aussi. Un livre, ça se tache, ça s'annote, ça se transmet. Le livre n'a jamais
              été le problème. Ce qui l'est, c'est tout ce qu'il y a autour : recopier, convertir
              les quantités, refaire la liste, retrouver la bonne page.
            </p>
            <p className="lp-punch">
              Le livre, tu l'ouvres avec plaisir. <em>Le reste t'épuise avant l'assiette.</em>
            </p>
          </div>
          <div className="lp-split__media">
            <SceneBooks />
          </div>
        </div>
      </section>

      {/* 4. Ce que fait Cardamome : la recette devient un objet structuré et vivant */}
      <section className="lp-wrap lp-section lp-slide">
        <div className="lp-split lp-split--reverse">
          <div>
            <span className="lp-eyebrow">Ce que fait Cardamome</span>
            <h2 className="lp-h2 lp-h2--wide">Une recette n'est pas juste du texte. Cardamome le sait.</h2>
            <p className="lp-p">
              Chaque recette est construite autour de ses <strong>ingrédients, ustensiles et
              techniques</strong>, avec détection automatique des <strong>produits de saison</strong>.
              Le mode pas à pas t'accompagne avec les bons gestes, minuteurs et astuces, au moment
              où tu en as besoin.
            </p>
            <p className="lp-punch">
              Tu n'exécutes pas naïvement. <em>Tu apprends quelque chose de nouveau à chaque recette.</em>
            </p>
          </div>
          <div className="lp-split__media">
            <div className="lp-dock">
              <PhoneFrame label="L'éditeur de recette de Cardamome : les champs se remplissent"><SceneEditor /></PhoneFrame>
              <span className="lp-dock__bar" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Import intelligent : la démonstration mise en avant, demo à droite */}
      <section id="import" className="lp-wrap lp-section lp-slide">
        <div className="lp-split lp-split--wide">
          <div>
            <span className="lp-eyebrow">L'import intelligent</span>
            <h2 className="lp-h2 lp-h2--wide">Les autres recopient. Cardamome comprend ta recette.</h2>
            <p className="lp-p">
              Extraire, c'est ranger des mots dans des cases. Comprendre, c'est révéler la
              composition de la recette. Ingrédients, ustensiles, techniques et sous-étapes
              prennent alors tout leur sens.
            </p>
            <p className="lp-punch">
              Un lien collé, une photo de page, une recette qui se cuisine. <em>Sans recopier une ligne.</em>
            </p>
          </div>
          <div className="lp-split__media">
            <ImportScene />
          </div>
        </div>
      </section>

      {/* 6. Prise de position sur le catalogue */}
      <section className="lp-wrap lp-section lp-slide">
        <div className="lp-split lp-split--reverse">
          <div className="lp-split__media">
            <SceneChosen />
          </div>
          <div>
            <span className="lp-eyebrow">Notre parti pris</span>
            <h2 className="lp-h2 lp-h2--wide">On pourrait te donner des milliers de recettes. À quoi bon ?</h2>
            <p className="lp-p">
              Tu n'as pas besoin de 47 recettes de carbonara. Une seule suffit : celle qui devient
              la tienne. Celle que tu maîtrises, que tu ajustes au fil du temps et que tu reprends
              les yeux fermés. Les recettes des autres sont là pour inspirer, pas pour encombrer.
            </p>
            <p className="lp-punch">
              Une bonne app ne te laisse pas te tourner les pouces. <em>Elle te pousse à cuisiner.</em>
            </p>
          </div>
        </div>
      </section>

      {/* 7. Manifeste : pleine largeur, prise de position assumée */}
      <section id="manifeste" className="lp-wrap lp-section lp-slide lp-manifest">
        <span className="lp-eyebrow">Le manifeste</span>
        <div className="lp-manifest__head">
          <h2 className="lp-manifest__lead">On n'est pas pour tout le monde. <em>Et on l'assume.</em></h2>
          <p className="lp-manifest__sub">
            Cardamome est faite pour celles et ceux qui veulent transformer leurs recettes
            sauvegardées en <strong>plats réellement cuisinés</strong>.
          </p>
        </div>
        <div className="lp-manifest__grid">
          <p><span className="lp-manifest__n">01</span>Plus de contenu ne rend pas une app <em>meilleure.</em></p>
          <p><span className="lp-manifest__n">02</span>Une recette n'existe vraiment qu'une fois <em>cuisinée.</em></p>
          <p><span className="lp-manifest__n">03</span>Le temps passé ici, c'est du temps <span className="lp-mute">volé à ta cuisine.</span></p>
          <p><span className="lp-manifest__n">04</span>On te veut meilleur cuisinier, <span className="lp-mute">pas meilleur client.</span></p>
        </div>
      </section>

      <ProofsSection />
      <OfferSection />

      {/* 10. Conclusion */}
      <section className="lp-wrap lp-section lp-final lp-slide">
        <h2 className="lp-final__title">Pas la plus grosse app. Celle que tu ouvres vraiment.</h2>
        <div className="lp-final__actions lp-cta-row">
          {primaryCta()}
          <StoreButtons />
        </div>
        <p className="lp-sign">Fait par des gens qui cuisinent pour de vrai, pas par un algorithme qui remplit des cases.</p>
      </section>

      <LandingFooter onAnchor={scrollToId} />
      </div>
    </div>
  );
}
