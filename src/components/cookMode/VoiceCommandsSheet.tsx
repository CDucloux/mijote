import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { Icon } from "../ui/Icon.jsx";
import { VOICE_HELP } from "@/lib/cookSession/voiceCommands.js";

interface VoiceCommandsSheetProps {
  onClose: () => void;
  zIndex?: number;
}

/**
 * Aide du mode mains libres : une carte par usage, et dans chacune un tableau
 * aligné « ce qu'on dit » / « ce que ça fait », variantes en petites étiquettes.
 */
export function VoiceCommandsSheet({ onClose, zIndex }: VoiceCommandsSheetProps) {
  return (
    <SwipeableSheet onClose={onClose} zIndex={zIndex}>
      <div className="voice-help">
        <header className="voice-help__head">
          <span className="voice-help__badge" aria-hidden="true"><Icon name="mic" size={20} weight="fill" /></span>
          <div>
            <h3 className="voice-help__title">Commandes vocales</h3>
            <p className="voice-help__lede">Parle normalement : la commande peut finir une phrase.</p>
          </div>
        </header>
        {VOICE_HELP.map(group => (
          <section key={group.title} className="voice-help__group" aria-label={group.title}>
            <h4 className="voice-help__group-title"><Icon name={group.icon} size={14} />{group.title}</h4>
            <dl className="voice-help__table">
              {group.entries.map(entry => (
                <div key={entry.say} className="voice-help__row">
                  <dt className="voice-help__say">{entry.say}</dt>
                  <dd className="voice-help__does">
                    {entry.does}
                    {entry.also && (
                      <span className="voice-help__also">
                        {entry.also.map(alias => <span key={alias} className="voice-help__alias">{alias}</span>)}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </SwipeableSheet>
  );
}
