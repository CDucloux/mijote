import "react";

/** Autorise les propriétés personnalisées CSS (`--tint`, `--text-rest`…) dans `style`, sans cast. */
declare module "react" {
  interface CSSProperties {
    [customProperty: `--${string}`]: string | number | undefined;
  }
}
