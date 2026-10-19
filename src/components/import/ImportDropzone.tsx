import { useState } from "react";
import { Icon, type IconName } from "../ui/Icon.jsx";

interface ImportDropzoneProps {
  icon: IconName;
  label: string;
  hint: string;
  /** Clic sur la zone : ouvre le sélecteur de fichiers natif. */
  onPick: () => void;
  onDropFiles: (files: FileList) => void;
}

/** Zone de dépôt de fichiers (glisser-déposer ou clic), surlignée pendant le survol. */
export function ImportDropzone({ icon, label, hint, onPick, onDropFiles }: ImportDropzoneProps) {
  const [drag, setDrag] = useState(false);
  return (
    <div className={`imp-dropzone${drag ? " drag" : ""}`} onClick={onPick}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); onDropFiles(e.dataTransfer.files); }}>
      <span className="plus"><Icon name={icon} size={26} color="currentColor" /></span>
      <span className="l">{label}</span>
      <span className="h">{hint}</span>
    </div>
  );
}
