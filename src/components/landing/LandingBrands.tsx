import { useId, type MouseEvent } from "react";
import { LogoPod } from "../ui/LogoPod.jsx";

/** Logo officiel Google Play (triangle multicolore, SVG inline, sans asset externe). */
function GooglePlayMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={(size * 256) / 283} height={size} viewBox="0 0 256 283" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid">
      <path d="M119.553141 134.916362 1.0599006 259.060547c2.6962939 9.556451 9.6583829 17.330053 18.8609652 21.05943 9.2025823 3.729376 19.6122577 2.995739 28.2008062-1.987493L181.448642 202.197919 119.553141 134.916362Z" fill="#EA4335" />
      <path d="M239.370822 113.813616 181.71353 80.7909097 116.815965 137.741834 181.978418 202.021326 239.19423 169.351804c10.331493-5.409352 16.80577-16.107154 16.80577-27.769094 0-11.66194-6.474277-22.359742-16.80577-27.769094l.176592 0Z" fill="#FBBC04" />
      <path d="M1.0599006 23.4868015C.343633396 26.134699-.01275388 28.8670014 0 31.6100341L0 250.937314c.00751268 2.741728.363556675 5.471398 1.0599006 8.123233L123.614758 138.095018 1.0599006 23.4868015Z" fill="#4285F4" />
      <path d="M120.436101 141.273674 181.71353 80.7909097 48.5631521 4.50316009C43.5539929 1.56944036 37.8568091 .015662967 32.0517989 0 17.6444261-.028487328 4.97836875 9.53420553 1.0599006 23.3985055L120.436101 141.273674Z" fill="#34A853" />
    </svg>
  );
}

/** Logo officiel App Store (carré arrondi dégradé + « A », SVG inline). */
function AppStoreMark({ size = 22 }: { size?: number }) {
  const gid = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid">
      <defs>
        <linearGradient x1="50%" y1="0%" x2="50%" y2="100%" id={gid}>
          <stop stopColor="#17C9FB" offset="0%" />
          <stop stopColor="#1A74E8" offset="100%" />
        </linearGradient>
      </defs>
      <path d="M56.0638473 0 199.936153 0C230.899361 0 256 25.1006394 256 56.0638473L256 199.936153C256 230.899361 230.899361 256 199.936153 256L56.0638473 256C25.1006394 256 0 230.899361 0 199.936153L0 56.0638473C0 25.1006394 25.1006394 0 56.0638473 0Z" fill={`url(#${gid})`} />
      <path d="M82.041678 185.810289 82.0657467 185.817889 73.3130924 200.977891C70.1182861 206.51167 63.0418283 208.407779 57.5080489 205.212719 51.9745229 202.018166 50.0784142 194.941709 53.2732205 189.407929L59.7211046 178.240042 60.3397975 177.16835C61.4449319 175.579561 64.1720448 172.838767 69.6270308 173.353838 69.6270308 173.353838 82.4637674 174.747037 83.3925667 181.418887 83.3928201 181.418887 83.5194976 183.614461 82.041678 185.810289L82.041678 185.810289ZM206.18511 147.089287 178.890925 147.089287C177.032313 146.96489 176.22031 146.3011 175.901843 145.915241L175.881574 145.880024 146.663918 95.2738878 146.626168 95.2992233 144.873712 92.786702C142.002187 88.3953002 137.442051 99.6272864 137.442051 99.6272864 131.997452 112.142769 138.21453 126.372451 140.382488 130.673152L180.963875 200.962183C184.158428 206.495962 191.234886 208.392071 196.768665 205.197011 202.302191 202.002458 204.1983 194.926001 201.003494 189.392221L190.855613 171.815973C190.659263 171.390337 190.316981 170.233771 192.398038 170.229211L206.18511 170.229211C212.574975 170.229211 217.755071 165.049115 217.755071 158.659249 217.755071 152.269383 212.574975 147.089287 206.18511 147.089287ZM153.171088 162.818324C153.171088 162.818324 154.627879 170.228957 148.99073 170.228957L143.353582 170.228957 143.353582 170.229211 48.0918579 170.229211C41.701992 170.229211 36.5218962 165.049115 36.5218962 158.659249 36.5218962 152.269383 41.701992 147.089287 48.0918579 147.089287L74.0318604 147.089287C78.2198182 146.846573 79.2127163 144.42906 79.2127163 144.42906L79.2355183 144.440715 113.095904 85.7925846 113.08577 85.7905577C113.703196 84.6575543 113.189139 83.5871295 113.099704 83.417635L101.917376 64.0494072C98.7223163 58.5156278 100.618425 51.4394233 106.152204 48.244617 111.685984 45.0495574 118.761935 46.9456661 121.956994 52.4794455L127.143171 61.4623995 132.320226 52.4954068C135.515033 46.9616274 142.591237 45.0655188 148.125016 48.2605784 153.658796 51.455638 155.554904 58.5318425 152.359845 64.0653685L105.242153 145.675313C105.036176 146.172142 104.97309 146.951969 106.505888 147.089287L134.670094 147.089287 134.676174 147.363671C134.676174 147.363671 150.954231 147.617026 153.171088 162.818324Z" fill="#FFFFFF" fillRule="nonzero" />
    </svg>
  );
}

/** Boutons « stores » : l'app native arrive (Capacitor), rien de public encore.
 *  États « à venir » NON cliquables : on n'invente aucun lien de téléchargement.
 *  Logos officiels Play Store / App Store (SVG inline, marques, hors set d'UI maison). */
export function StoreButtons() {
  return (
    <div className="lp-store" role="group" aria-label="Applications mobiles à venir">
      <span className="lp-store__btn" aria-disabled="true">
        <GooglePlayMark size={22} />
        <span className="lp-store__txt"><small>Bientôt sur</small><b>Google Play</b></span>
        <span className="lp-store__soon">à venir</span>
      </span>
      <span className="lp-store__btn" aria-disabled="true">
        <AppStoreMark size={22} />
        <span className="lp-store__txt"><small>Bientôt sur</small><b>App Store</b></span>
        <span className="lp-store__soon">à venir</span>
      </span>
    </div>
  );
}

// Marques sociales officielles (chemins monochromes, viewBox 24, rendus en
// currentColor pour un traitement homogène). Volontairement hors du set d'icônes
// maison : ce sont des logos de marque, pas des pictos d'UI.
const SOCIALS = [
  { id: "instagram", label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
  { id: "facebook", label: "Facebook", path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  { id: "x", label: "X", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
  { id: "linkedin", label: "LinkedIn", path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" },
];

/** Logos sociaux dans le footer. Les comptes ne sont pas encore ouverts : dans
 *  l'esprit des boutons stores, on n'invente aucun lien. Icônes NON cliquables
 *  (spans, aria-disabled) qui deviendront des <a href> le jour où les profils
 *  existent. */
function Socials() {
  return (
    <div className="lp-socials" role="group" aria-label="Réseaux sociaux (bientôt)">
      {SOCIALS.map((s) => (
        <span key={s.id} className="lp-social" aria-disabled="true" title={`${s.label}, bientôt`} aria-label={`${s.label}, bientôt`}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d={s.path} /></svg>
        </span>
      ))}
    </div>
  );
}

/** Pied de page : marque, stores, réseaux, ancres de la page et liens légaux. */
export function LandingFooter({ onAnchor }: { onAnchor: (id: string) => (e?: MouseEvent) => void }) {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer__inner">
        <div className="lp-footer__brand">
          <div className="lp-footer__mark">
            <LogoPod size={30} />
            <span className="lp-brand">Cardam<span className="lp-brand__dot">o</span>me<span className="lp-brand__dot">·</span></span>
          </div>
          <p className="lp-footer__tag">Cuisine, chaleur, gourmandise. L'app qui t'aide à cuisiner pour de vrai, pas à collectionner des recettes.</p>
          <StoreButtons />
          <Socials />
        </div>
        <nav className="lp-footer__col">
          <span className="lp-footer__h">L'app</span>
          <a href="#probleme" onClick={onAnchor("probleme")}>Le problème</a>
          <a href="#fonctionnalites" onClick={onAnchor("fonctionnalites")}>Les fonctionnalités</a>
          <a href="#offre" onClick={onAnchor("offre")}>L'offre</a>
        </nav>
        <nav className="lp-footer__col">
          <span className="lp-footer__h">Légal</span>
          <a href="/legal/terms">CGU</a>
          <a href="/legal/sales">CGV</a>
          <a href="/legal/privacy">Confidentialité</a>
          <a href="/legal">Informations légales</a>
        </nav>
      </div>
      <div className="lp-wrap lp-footer__base">
        <span className="lp-footer__meta">© 2026 Cardamome · v{__APP_VERSION__}</span>
        <span className="lp-footer__made">Fait avec soin, pas à la chaîne.</span>
      </div>
    </footer>
  );
}
