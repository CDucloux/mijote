
# Listes des fontionnalités à mijoter

## ✅ Fait — v1.0 Cardamome

- [x] Auth & Sync
  - [x] Authentification Google avec avatar
  - [x] Intégration Firebase Firestore + Auth Google

- [x] Système de Recettes
  - [x] Mode recette pas à pas (cook mode)
  - [x] Recherche par ingrédient
  - [x] Ingrédients : quantités et unités inférées
  - [x] Tags : saisie sans virgule
  - [x] Display du lien source dans la recette

- [x] Import / Export
  - [x] Drag & drop JSON
  - [x] Rework UI import/export (volets dépliables)

- [x] Navigation & UX
  - [x] Landing page avant connexion
  - [x] Planning : corrections des bugs

- [x] Inventaire et Mode Frigo


## 🔜 Backlog — v1.1

- [ ] UI
  - [x] A la fois un sujet UI et Backend, mais un score de santé ne peut par construction jamais être à 100 (si il est à 100 côté UI c'est moche en plus)
  - [x] Le nom récupéré via Google Auth doit etre affiché en MAJUSCULE
  - [x] Switcher le thème doit être déporté dans la partie profil quand je clique sur l'avatar 
  - [x] Sur desktop comme sur mobile, quand on clique sur une recette pour l'afficher en détail, il faut faire en sorte que l'affichage ne soit pas instantanné (encore une fois, UX)
  - [X] Sur mobile, dans la partie recette - pouvoir avoir la fonctionnalité style "swiper" à droite pour passer de manière fluide entre ingrédidents, ustensiles et étapes (pareil pour le formulaire nouvelle recette ou modifier la recette, + le switch entre info, ingrédients, ustensiles et étapes doit etre + fluide)
  - [x] Quand on est en mode light, corriger le bug UI dans "Mon Frigo" le bouton "Tous" est trop noir
  - [x] Uniformiser la hauteur des titres quand sur mobile + avatar
  - [x] Sur mobile, avoir la possibilité de faire glisser vers les bas certains popups (Ajouter au planning, ajouter aux courses, ajouter au frigo, supprimer la recette, supprimer la liste)

- [ ] App & légal
  - [ ] Page À propos — licence, crédits, copyright


## 🔭 Horizon — v1.2+

- [ ] Communauté de mijoteurs !

- [ ] Proposition automatique de plan sur une semaine
  - [ ] Mode fainéant (recettes rapides)
  - [ ] Filtre saisonnier (été / hiver / …)


- [ ] Qualité & contenu
  - [ ] Score de santé plus élaboré (pondération, Nutri-Score plus fidèle ?)
  - [ ] Export PDF revu et amélioré ?
  - [ ] Génération de recette via API Claude / ChatGPT (clé API utilisateur)