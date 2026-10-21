/**
 * Garde-rotation (navigateur) : masque l'app en paysage sur téléphone, où la mise en
 * page basculerait vers un rendu desktop inadapté. CSS seul (cf. `.rotate-guard`),
 * inerte hors du cas ciblé.
 */
export function RotateGuard() {
  return (
    <div className="rotate-guard" aria-hidden="true">
      <div className="rotate-guard__icon">📱</div>
      <div className="rotate-guard__title">Tourne ton téléphone</div>
      <div className="rotate-guard__hint">Cardamome est pensé pour le mode portrait. Remets ton écran à la verticale pour continuer.</div>
    </div>
  );
}
