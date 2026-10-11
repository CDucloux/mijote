/**
 * Export d'un fichier texte généré (JSON, YAML, Markdown, agenda .ics), quel que
 * soit le contexte d'exécution.
 *
 * Sur le web, un lien `<a download>` vers un blob suffit. Dans la coquille
 * Capacitor Android, la WebView ignore silencieusement ces liens : aucun
 * téléchargement, aucune erreur. On écrit donc le fichier dans le cache de l'app
 * puis on ouvre la feuille de partage de l'OS, d'où l'utilisateur l'enregistre
 * (Fichiers, Drive) ou l'ouvre directement (un .ics dans l'agenda).
 *
 * La décision et la normalisation sont pures ({@link chooseExportStrategy},
 * {@link safeFileName}, {@link isShareCancel}) ; {@link exportTextFile} est la
 * seule glue impure.
 *
 * @module ui/fileExport
 */
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/** Canal d'export selon la coquille d'exécution. */
export type ExportStrategy = "download" | "share";

/** Issue d'un export : téléchargé (web), partagé (natif) ou abandonné par l'utilisateur. */
export type ExportOutcome = "downloaded" | "shared" | "cancelled";

/**
 * Choisit le canal d'export : feuille de partage en natif (la WebView ignore
 * `<a download>`), téléchargement direct sur le web.
 *
 * @param isNative - Exécution dans la coquille Capacitor.
 * @returns `"share"` en natif, `"download"` sur le web.
 */
export function chooseExportStrategy(isNative: boolean): ExportStrategy {
  return isNative ? "share" : "download";
}

/**
 * Nom de fichier sûr pour le système de fichiers de l'appareil : les caractères
 * interdits ou porteurs de chemin (`/ \ : * ? " < > |`, contrôles) deviennent
 * des tirets bas, les espaces de bord sont retirés. Un nom vide ou réduit à des
 * points retombe sur `export.txt`, pour ne jamais écrire hors du cache.
 *
 * @param filename - Nom proposé (peut venir d'un titre de recette).
 * @returns Un nom de fichier sans séparateur de chemin.
 */
export function safeFileName(filename: string): string {
  const cleaned = filename.replace(/[/\\:*?"<>|\u0000-\u001f]/g, "_").trim();
  return /^\.*$/.test(cleaned) ? "export.txt" : cleaned;
}

/**
 * Vrai si l'erreur du plugin de partage traduit un simple abandon de
 * l'utilisateur (feuille fermée sans choisir d'app), à ne pas signaler comme
 * un échec.
 *
 * @param error - L'erreur rejetée par `Share.share`.
 * @returns `true` pour une annulation.
 */
export function isShareCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /cancel/i.test(message);
}

function downloadInBrowser(filename: string, text: string, mime: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  a.click();
  // Différé : certains navigateurs lisent le blob après le retour de click().
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function shareFromCache(filename: string, text: string): Promise<ExportOutcome> {
  const { uri } = await Filesystem.writeFile({
    path: safeFileName(filename),
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: filename, files: [uri] });
    return "shared";
  } catch (error) {
    if (isShareCancel(error)) return "cancelled";
    throw error;
  }
}

/**
 * Exporte un fichier texte par le canal adapté à la plateforme (voir
 * {@link chooseExportStrategy}).
 *
 * @param filename - Nom du fichier proposé à l'utilisateur.
 * @param text - Contenu du fichier.
 * @param mime - Type MIME (utilisé pour le téléchargement web).
 * @returns `"downloaded"` sur le web, `"shared"` ou `"cancelled"` en natif.
 * Rejette si l'écriture ou le partage natif échoue.
 */
export async function exportTextFile(filename: string, text: string, mime = "text/plain"): Promise<ExportOutcome> {
  if (chooseExportStrategy(Capacitor.isNativePlatform()) === "share") return shareFromCache(filename, text);
  downloadInBrowser(filename, text, mime);
  return "downloaded";
}
