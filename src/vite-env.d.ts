/// <reference types="vite/client" />

/**
 * Variables d'environnement Vite exposées à l'app (préfixe `VITE_`). Typé ici pour
 * que `import.meta.env.*` soit vérifié à la compilation.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  readonly VITE_ALLOWED_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Version de l'app, injectée au build par Vite (`define`). */
declare const __APP_VERSION__: string;
