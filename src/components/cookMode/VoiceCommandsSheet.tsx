import { Fragment } from "react";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { StickySheetHeader } from "../ui/StickySheetHeader.jsx";
import { Icon } from "../ui/Icon.jsx";
import { VOICE_HELP } from "@/lib/cookSession/voiceCommands.js";

interface VoiceCommandsSheetProps {
  onClose: () => void;
  zIndex?: number;
}

/**
 * Aide du mode mains libres : en-tête collant, puis une carte par usage. Chaque
 * carte est un tableau à deux colonnes : la phrase à dire en touche claire (la
 * colonne prend la largeur de la plus longue), ce qu'elle fait, et ses variantes.
 */
export function VoiceCommandsSheet({ onClose, zIndex }: VoiceCommandsSheetProps) {
  return (
    <SwipeableSheet onClose={onClose} zIndex={zIndex} hideHandle style={{ paddingTop: 0 }}>
      <StickySheetHeader>
        <div className="voice-help__head">
          <span className="voice-help__badge" aria-hidden="true"><Icon name="mic" size={20} weight="fill" /></span>
          <div>
            <h3 className="voice-help__title">Commandes vocales</h3>
            <p className="voice-help__lede">Parle normalement : la commande peut finir une phrase.</p>
          </div>
        </div>
      </StickySheetHeader>
      {VOICE_HELP.map(group => (
        <section key={group.title} className="voice-help__group" aria-label={group.title}>
          <h4 className="voice-help__group-title"><Icon name={group.icon} size={14} />{group.title}</h4>
          <dl className="voice-help__table">
            {group.entries.map(entry => (
              <Fragment key={entry.say}>
                <dt className="voice-help__say">{entry.say}</dt>
                <dd className="voice-help__does">
                  {entry.does}
                  {entry.also && <span className="voice-help__also">ou {entry.also.map(alias => `« ${alias} »`).join(", ")}</span>}
                </dd>
              </Fragment>
            ))}
          </dl>
        </section>
      ))}
    </SwipeableSheet>
  );
}
