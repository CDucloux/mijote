import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { Icon } from "../ui/Icon.jsx";
import { VOICE_HELP } from "@/lib/cookSession/voiceCommands.js";

interface VoiceCommandsSheetProps {
  onClose: () => void;
  zIndex?: number;
}

/** Aide du mode mains libres : toutes les commandes vocales, par usage. */
export function VoiceCommandsSheet({ onClose, zIndex }: VoiceCommandsSheetProps) {
  return (
    <SwipeableSheet onClose={onClose} zIndex={zIndex}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ flexShrink: 0, width: 42, height: 42, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center" }}>
          <Icon name="mic" size={20} weight="fill" />
        </span>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: "var(--text)" }}>Commandes vocales</h3>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 20px" }}>
        Parle normalement, la commande peut finir une phrase. « Ferme » pour revenir à la recette.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {VOICE_HELP.map(group => (
          <section key={group.title}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{group.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {group.entries.map(entry => (
                <div key={entry.say} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ flexShrink: 0, padding: "4px 11px", borderRadius: 999, background: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                    « {entry.say} »
                  </span>
                  <span style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.45 }}>{entry.does}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </SwipeableSheet>
  );
}
