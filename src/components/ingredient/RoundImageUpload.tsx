import { useRef, type ChangeEvent } from "react";
import { Icon } from "../ui/Icon.jsx";
import { IngImage } from "../ui/Img.jsx";
import { useImageUpload } from "../../hooks/useImageUpload.js";

interface RoundImageUploadProps {
  value: string | undefined;
  onChange: (url: string) => void;
  size?: number;
}

/** Photo ronde éditable en place : un clic change la photo (Storage, repli base64). */
export function RoundImageUpload({ value, onChange, size = 82 }: RoundImageUploadProps) {
  const inputId = useRef("ingimg_" + Math.random().toString(36).slice(2)).current;
  const { uploading, upload } = useImageUpload("master/ingredients");
  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0]; if (!file) return;
    const url = await upload(file);
    if (url !== null) onChange(url);
    input.value = "";
  };
  return (
    <label htmlFor={inputId} title="Changer la photo" style={{ position: "relative", flexShrink: 0, cursor: "pointer", display: "block", borderRadius: "50%", boxShadow: "0 4px 14px -6px rgba(0,0,0,0.25)" }}>
      <IngImage src={value} alt="" size={size} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.42)", display: "grid", placeItems: "center" }}>
        {uploading
          ? <span style={{ width: 20, height: 20, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          : <Icon name="photo" size={20} color="#fff" />}
      </span>
      <input id={inputId} type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
    </label>
  );
}
