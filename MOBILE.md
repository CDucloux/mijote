# Cardamome sur mobile (Capacitor) : build et publication

Ce document couvre l'empaquetage de la PWA Cardamome en application native via
**Capacitor**, puis sa publication sur le **Google Play Store** (Internal testing,
Closed testing, Production). L'App Store iOS est prévu plus tard (voir la fin).

Principe : l'app web reste hébergée sur Vercel et **inchangée**. Capacitor embarque
le build (`dist/`) dans une coquille native. Un `npm run cap:sync` reconstruit le
web et le pousse dans le projet natif ; on rebuild ensuite l'app dans Android Studio.

> État actuel : le projet natif `android/` est **généré et committé**, l'app
> **tourne sur appareil** et l'**auth Google native fonctionne** (Phase 1 + Phase 2
> faites, cf. §5). Ce document reste le mode d'emploi pour rebuild, publier, et
> reproduire la config sur une nouvelle machine. La section **§8 Dépannage** liste
> les pièges réels rencontrés et leurs solutions : la lire AVANT de s'arracher les
> cheveux.

---

## 1. Prérequis (poste de dev, en local)

Le build de l'AAB ne se fait PAS dans l'environnement distant (pas de SDK Android) :
il se fait sur ta machine.

- [ ] **Node 22** (déjà utilisé pour le web).
- [ ] **Android Studio** (dernier stable) + **JDK 21** + **Android SDK** (installés via Android Studio).
      Le projet natif compile en **Java 21** (`android/app/capacitor.build.gradle`) : dans Android Studio,
      *Settings > Build Tools > Gradle > Gradle JDK* = **21** (le JBR embarqué). Un JDK 8/11 fait échouer le build.
- [ ] Un **keystore de signature** (`.jks`) OU l'usage de **Play App Signing** (recommandé, voir §5).
- [ ] Un **chemin de projet 100 % ASCII**, sans accent ni caractère spécial (l'AGP refuse
      un chemin non-ASCII sur Windows). Éviter aussi les espaces. Ex. : `D:\dev\cardamome`.
- [ ] Pour l'**émulateur** : la **virtualisation** doit être activée (BIOS : VT-x Intel / SVM AMD),
      et un hyperviseur installé (WHPX ou *Android Emulator hypervisor driver*), sinon il gèle au boot.
      Alternative plus fiable : tester sur un **vrai téléphone** (cf. §8).

## 2. Générer le projet Android

Le dossier natif `android/` est **déjà généré et committé** dans le dépôt (avec
`applicationId`/`namespace` = `studio.cardamome`). Un simple `git pull` + `npm install`
suffit pour buildar. On ne régénère `android/` que si on change l'`appId` ou qu'on
repart de zéro :

```bash
npm install
npm run build            # produit dist/
# UNIQUEMENT si régénération nécessaire (ex. changement d'appId) :
#   rmdir /s /q android   (Windows) puis :
npx cap add android      # recrée android/ à partir de capacitor.config.json
```

Bon à savoir :
- Le **plugin Gradle google-services est déjà câblé** par le template Capacitor
  (`android/build.gradle` a la `classpath`, `android/app/build.gradle` applique le
  plugin automatiquement dès que `google-services.json` existe). **Aucune ligne
  Gradle à ajouter à la main.**
- Les **secrets sont ignorés** par `android/.gitignore` (durci : `*.jks`, `*.keystore`,
  `keystore.properties`). Ne jamais committer la clé de signature.
- `google-services.json` n'est **pas** un secret dur (config client, verrouillée par
  package + SHA-1) : le committer est acceptable, ou l'ignorer, au choix.

## 3. Cycle de build à chaque nouvelle version

```bash
npm run cap:sync         # = vite build + cap sync (met dist/ dans android/)
npm run cap:android      # ouvre le projet dans Android Studio
```

Dans Android Studio : **Build > Generate Signed App Bundle / APK > Android App
Bundle**, choisir/creer la clé de signature, produire le fichier **`.aab`**.

## 4. `appId` : à verrouiller AVANT la première publication

`capacitor.config.json` porte `"appId": "studio.cardamome"` (reverse-domain de
`cardamome.studio`). Cet identifiant est **IMMUABLE une fois l'app publiée sur
Play** (il devient le `applicationId` Android).

- [ ] Confirmer l'`appId` en reverse-domain d'un domaine que tu contrôles
      (ici `studio.cardamome` pour `cardamome.studio`).
      Le changer plus tard = nouvelle fiche Play, nouvelle app.

## 5. Auth Google native (Phase 2)

Le `signInWithPopup` web de Firebase ne marche pas dans la WebView Capacitor. La
bascule vers l'auth native est **déjà codée** : `googleSignIn` (dans
`src/lib/firebase/googleAuth.ts`) choisit le canal selon la plateforme (popup web
vs SDK Google natif via `@capacitor-firebase/authentication`, puis credential ->
Firebase JS). Le web est inchangé. `capacitor.config.json` porte déjà la config du
plugin (`skipNativeAuth: true`, provider `google.com`).

La **configuration native** (côté Firebase / Google, pas du code) doit être faite
**dans cet ordre précis** (l'ordre compte, cf. l'explication en fin de section) :

1. [ ] **Firebase Auth > Sign-in method > Google > Activer** (avec e-mail d'assistance).
       C'est ce qui **crée le client OAuth « Web »** dont le SDK natif a besoin pour
       obtenir un idToken. À faire EN PREMIER.
2. [ ] **Firebase > Paramètres du projet > Vos applications > Ajouter une app Android**,
       package name **exactement `studio.cardamome`** (doit matcher l'`applicationId`).
3. [ ] Ajouter le **SHA-1** (et SHA-256) de la clé de signature dans cette app Android
       (*Empreintes > Ajouter une empreinte*). Pour le **debug** (émulateur + tests locaux),
       l'empreinte de la clé debug suffit. Le récupérer via Android Studio (immunisé contre
       le bug keytool, cf. §8) : panneau **Gradle > Execute Gradle Task > `signingReport`**,
       bloc **`Variant: debug`**. Avec **Play App Signing**, ajouter EN PLUS l'empreinte
       fournie par Play (Play Console > App integrity).
4. [ ] **Télécharger `google-services.json`** (APRÈS avoir activé Google ET ajouté le SHA-1)
       et le déposer dans **`android/app/`**.
5. [ ] **Vérifier** que le fichier contient bien le client web : il doit y avoir un
       `"client_type": 3` (en plus du `"client_type": 1` android). Sans lui, la connexion
       échoue **direct, sans même ouvrir le sélecteur de compte**.
6. [ ] Vérifier que le domaine de prod est dans **Firebase Auth > Authorized domains**.
7. [ ] **Rebuild propre** : `npm run cap:sync`, puis dans Android Studio **Sync Gradle**
       (c'est là que la ressource `default_web_client_id` est générée), **Build > Clean
       Project**, **désinstaller** l'ancienne app de l'appareil, puis **Run**.

Diagnostic express si « Connexion échouée » :
- **Échec direct, aucun sélecteur de compte** → client web manquant : provider Google pas
  activé au moment du téléchargement, ou `google-services.json` périmé (refaire 1, 4, 5, 7).
- **Sélecteur affiché puis échec après le choix** → problème de **SHA-1** (code Logcat
  `ApiException: 10`, DEVELOPER_ERROR) : SHA-1 absent/faux ou pas encore propagé.
- **« No credentials available »** → côté **appareil**, pas la config : aucun compte Google
  sur le device, ou Play Services trop vieux (typique des **images d'émulateur preview**).
  Ajouter un compte Google, ou tester sur un **vrai téléphone** (cf. §8).

Pourquoi l'ordre : le SDK natif demande un idToken via le **client OAuth web**, dont
l'ID (`default_web_client_id`) est injecté dans les ressources Android par le plugin
Gradle google-services, **à partir de `google-services.json`**, **au moment du sync
Gradle**. Si le provider Google n'était pas activé au téléchargement, ce client n'existe
pas dans le fichier ; si le fichier a changé sans re-sync + rebuild, la ressource n'est
pas dans l'APK. D'où : activer Google d'abord, re-télécharger, vérifier le `3`, rebuild propre.

---

## 6. Publication Play Store : les 3 paliers

### Setup commun (une fois, avant tout envoi)

- [ ] Créer un **compte Google Play Console** (25 $ une fois) + **vérification d'identité**.
- [ ] Créer l'app dans la console (nom « Cardamome », langue, type « Application », gratuite).
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

---

## 8. Dépannage (galères réelles et solutions)

Pièges rencontrés lors du premier build/run, avec le fix qui marche.

### Toolchain

- **`Your project path contains non-ASCII characters`** (build Gradle échoue d'entrée).
  Le dossier du projet contient un accent/caractère spécial (ex. `Mijoté`). Déplacer le
  dépôt dans un chemin **100 % ASCII** sans espace (`D:\dev\cardamome`). Le flag
  `android.overridePathCheck=true` ne fait que repousser le mur, ne pas l'utiliser.

- **`Dependency requires at least JVM runtime version 11. This build uses a Java 8 JVM`**
  (en lançant `gradlew` depuis un terminal). Le shell utilise un vieux `JAVA_HOME` (Java 8),
  alors que le projet compile en **Java 21**. Deux options : lancer les tâches Gradle
  **depuis Android Studio** (il a son JDK 21 interne), ou pointer le shell dessus :
  `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"` avant `.\gradlew ...`.

- **`keytool` : `MissingFormatArgumentException: Format specifier '%2$s'`** en listant la
  clé. Bug de `keytool` sous **locale française**. Contournements : forcer l'anglais
  `keytool "-J-Duser.language=en" "-J-Duser.country=US" -list ...` (guillemets obligatoires
  en PowerShell), ou plus simple **passer par `signingReport`** dans Android Studio
  (panneau Gradle > Execute Gradle Task > `signingReport`).

- **`keytool`/`adb` non reconnus** : pas dans le PATH. `adb` est dans
  `%LOCALAPPDATA%\Android\Sdk\platform-tools\`, `keytool` dans
  `C:\Program Files\Android\Android Studio\jbr\bin\`. Pour Logcat/signingReport, tout se
  fait dans l'IDE, sans ligne de commande.

- **Nudges Android Studio « AGP upgrade » / « Migrate to Gradle Daemon toolchain »** :
  **ignorer**. Le dossier `android/` est généré et piloté par Capacitor ; ses versions
  (AGP, Gradle) montent via `@capacitor/android` + `cap sync`, pas via l'Upgrade Assistant
  (qui réécrirait des fichiers générés et créerait de la dérive).

### Émulateur

- **Image système** : prendre une image **STABLE** avec **Google Play** (ex. API 35),
  **pas** une image **preview/canary** (ex. « API 37 ») : leurs Google Play Services
  expérimentaux cassent l'auth (« No credentials available », cf. plus bas).
- **Gèle au boot / « failed to connect within 5 minutes »** : accélération manquante.
  Vérifier la **virtualisation** (Gestionnaire des tâches > Performances > Processeur),
  l'activer au **BIOS** si besoin, installer WHPX ou l'*Android Emulator hypervisor driver*
  (SDK Tools), **redémarrer le PC** (le driver ne s'active qu'après reboot). Vérifier avec
  `emulator -accel-check`.
- **Toujours figé malgré une accél OK** : dans l'AVD (Edit > Advanced), passer **Graphics**
  en **Software - GLES 2.0** et **Boot** en **Cold boot**, puis **Wipe Data**. Ne pas
  reboot l'émulateur entre deux `Run` (le laisser allumé, `Run` réinstalle juste l'app).
- **`No credentials available` au login** : c'est côté **appareil**, pas la config. Le
  Credential Manager ne trouve aucun compte Google. Ajouter un compte (Paramètres > Comptes,
  ou se connecter au Play Store), et surtout **éviter les images preview**. Le plus fiable
  reste un **vrai téléphone**.

### Vrai téléphone (le plus fiable pour l'auth)

- **Débogage USB** : Paramètres > À propos > taper 7× sur « Numéro de build », puis
  Options développeur > **Débogage USB**. Brancher en **câble data** (pas charge-only),
  passer l'USB en **MTP / Transfert de fichiers**, accepter le popup « Autoriser le
  débogage USB ». Si l'appareil n'apparaît pas : installer le **Google USB Driver**
  (SDK Tools) ou le driver constructeur. `adb devices` doit lister l'appareil en `device`
  (pas `unauthorized`/`offline`).

### UI native (edge-to-edge / safe-areas)

- Depuis Android 15+, la WebView peint **bord à bord** (sous les barres système). Le CSS
  gère déjà les insets : `env(safe-area-inset-top)` sur `#root`/`.login-root` (haut),
  `env(safe-area-inset-bottom)` sur la tab bar et les pieds d'écran. Ces valeurs sont
  **nulles hors natif/PWA** (aucun impact web). Si un **nouvel écran** remonte sous une
  barre système, réserver l'inset correspondant sur son conteneur racine (pas au cas par
  cas dans le contenu).
