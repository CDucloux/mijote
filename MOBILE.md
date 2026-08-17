# Mijoté sur mobile (Capacitor) : build et publication

Ce document couvre l'empaquetage de la PWA Mijoté en application native via
**Capacitor**, puis sa publication sur le **Google Play Store** (Internal testing,
Closed testing, Production). L'App Store iOS est prévu plus tard (voir la fin).

Principe : l'app web reste hébergée sur Vercel et **inchangée**. Capacitor embarque
le build (`dist/`) dans une coquille native. Un `npm run cap:sync` reconstruit le
web et le pousse dans le projet natif ; on rebuild ensuite l'app dans Android Studio.

> Note importante : le scaffold Capacitor (Phase 1) rend l'app buildable, mais
> l'**authentification Google ne fonctionnera pas telle quelle dans la WebView**
> (voir la section « Auth » : c'est la Phase 2, requise pour un beta utilisable).

---

## 1. Prérequis (poste de dev, en local)

Le build de l'AAB ne se fait PAS dans l'environnement distant (pas de SDK Android) :
il se fait sur ta machine.

- [ ] **Node 22** (déjà utilisé pour le web).
- [ ] **Android Studio** (dernier stable) + **JDK 17** + **Android SDK** (installés via Android Studio).
- [ ] Un **keystore de signature** (`.jks`) OU l'usage de **Play App Signing** (recommandé, voir §5).

## 2. Générer le projet Android (une seule fois, en local)

Le dépôt contient déjà `capacitor.config.json` et les dépendances Capacitor. Il
reste à générer le dossier natif `android/` sur ta machine (pour qu'il colle à ta
toolchain locale) :

```bash
npm install
npm run build            # produit dist/
npx cap add android      # crée le dossier android/ (à committer)
```

## 3. Cycle de build à chaque nouvelle version

```bash
npm run cap:sync         # = vite build + cap sync (met dist/ dans android/)
npm run cap:android      # ouvre le projet dans Android Studio
```

Dans Android Studio : **Build > Generate Signed App Bundle / APK > Android App
Bundle**, choisir/creer la clé de signature, produire le fichier **`.aab`**.

## 4. `appId` : à verrouiller AVANT la première publication

`capacitor.config.json` porte `"appId": "app.mijote"`. Cet identifiant est
**IMMUABLE une fois l'app publiée sur Play** (il devient le `applicationId` Android).

- [ ] Confirmer l'`appId` en reverse-domain d'un domaine que tu contrôles
      (ex. `app.mijote` si tu as `mijote.app`, `fr.mijote` si `mijote.fr`).
      Le changer plus tard = nouvelle fiche Play, nouvelle app.

## 5. Auth Google native (Phase 2)

Le `signInWithPopup` web de Firebase ne marche pas dans la WebView Capacitor. La
bascule vers l'auth native est **déjà codée** : `googleSignIn` (dans
`src/lib/firebase/googleAuth.ts`) choisit le canal selon la plateforme (popup web
vs SDK Google natif via `@capacitor-firebase/authentication`, puis credential ->
Firebase JS). Le web est inchangé. `capacitor.config.json` porte déjà la config du
plugin (`skipNativeAuth: true`, provider `google.com`).

Il reste la **configuration native** (côté Firebase / Google, pas du code) :

- [ ] Dans **Firebase Auth**, activer le fournisseur **Google** (crée le client OAuth
      « Web » dont le SDK natif a besoin pour obtenir un idToken).
- [ ] Enregistrer l'app **Android** (`appId` = `app.mijote`) dans le projet Firebase,
      puis télécharger **`google-services.json`** et le déposer dans `android/app/`.
- [ ] Enregistrer le **SHA-1** (et SHA-256) de ta clé de signature dans Firebase
      (Paramètres du projet > ton app Android > Empreintes). Avec **Play App Signing**,
      prendre l'empreinte fournie par Play (Play Console > App integrity) EN PLUS de
      ta clé d'upload. **Régénérer `google-services.json` après avoir ajouté le SHA-1.**
- [ ] Vérifier que le domaine de prod est dans **Firebase Auth > Authorized domains**.
- [ ] `npm run cap:sync` (le plugin installe sa partie native), puis tester la
      connexion sur un vrai appareil.

Tant que le SHA-1 et `google-services.json` ne sont pas en place, la connexion
Google échouera dans l'app installée (le code, lui, est prêt).

---

## 6. Publication Play Store : les 3 paliers

### Setup commun (une fois, avant tout envoi)

- [ ] Créer un **compte Google Play Console** (25 $ une fois) + **vérification d'identité**.
- [ ] Créer l'app dans la console (nom « Mijoté », langue, type « Application », gratuite).
- [ ] Renseigner **App content / Contenu de l'app** :
  - [ ] **Politique de confidentialité** (URL hébergée : obligatoire, tu as des comptes utilisateurs / RGPD).
  - [ ] **Data safety / Sécurité des données** : déclarer les données collectées (Firebase Auth, Firestore : e-mail, contenu utilisateur…).
  - [ ] **Classification du contenu** (questionnaire).
  - [ ] **Public cible et contenu**, **Annonces** (déclarer si pub : non), **Applications gouvernementales** (non).
- [ ] **Fiche Play Store** (Store listing) :
  - [ ] Icône **512×512** (PNG 32 bits), **feature graphic 1024×500**.
  - [ ] **2 à 8 captures** téléphone, description courte + longue.
- [ ] Activer **Play App Signing** (recommandé : Google garde la clé, tu fournis une clé d'upload).

### Palier A : Internal testing (beta privé le plus rapide)

Idéal pour un cercle restreint : disponibilité quasi immédiate, jusqu'à 100 testeurs.

- [ ] Play Console > **Test > Internal testing** > créer une release.
- [ ] Uploader l'**`.aab`**.
- [ ] Créer la **liste de testeurs** (e-mails Google des testeurs, jusqu'à 100).
- [ ] **Review release** puis **Rollout**.
- [ ] Partager le **lien d'opt-in** aux testeurs ; ils rejoignent puis installent via Play.
- [ ] Vérifier que l'auth (Phase 2) fonctionne sur un vrai appareil.

### Palier B : Closed testing (tremplin vers la prod)

Requis pour débloquer la production sur un **compte personnel** récent :
**≥ 20 testeurs pendant ≥ 14 jours** sur un test fermé, avant de demander l'accès prod.

- [ ] Play Console > **Test > Closed testing** > créer/gérer une piste (ex. « beta »).
- [ ] Constituer la liste : **liste d'e-mails** ou **Google Group** (≥ 20 testeurs actifs).
- [ ] Uploader l'`.aab`, **Rollout**, partager le lien d'opt-in.
- [ ] **Laisser tourner ≥ 14 jours** avec des testeurs qui installent/utilisent réellement.
- [ ] (Recommandé) Recueillir retours + itérer via de nouvelles releases sur cette piste.

> Les comptes **organisation** (avec numéro D-U-N-S) sont généralement exemptés de
> la règle 20 testeurs / 14 jours.

### Palier C : Production

- [ ] Une fois la condition de test fermé remplie : **demander l'accès à la production**
      (Play Console propose la démarche depuis la section Production).
- [ ] Créer la release **Production**, uploader l'`.aab` final.
- [ ] Revue Google (peut prendre de quelques heures à quelques jours).
- [ ] **Rollout progressif** (staged rollout : 10 % → 50 % → 100 %) recommandé.

> Les libellés exacts du Play Console peuvent évoluer ; le déroulé ci-dessus reste
> valable. Politiques et frais Google peuvent aussi changer : vérifier la doc officielle.

---

## 7. iOS (plus tard)

Nécessite un **Mac + Xcode** et un **compte Apple Developer (99 $/an)** : parqué
tant que tu n'as pas les deux.

- [ ] `npx cap add ios` (le projet est déjà prêt côté config).
- [ ] Ajouter **Sign in with Apple** (Apple l'EXIGE dès qu'un login tiers comme Google
      est proposé, guideline 4.8) : à brancher dans Firebase Auth.
- [ ] Publier en beta via **TestFlight** (équivalent des pistes de test Play).
- [ ] Soigner la valeur native (caméra pour l'import photo, partage, push) pour passer
      la guideline **4.2** (Apple refuse les simples coquilles web).
