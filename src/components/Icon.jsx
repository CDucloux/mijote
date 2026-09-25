// ─── ICONS ────────────────────────────────────────────────────────────────────
// Fine façade au-dessus de Phosphor : les sites d'appel restent <Icon name="…" />,
// le prop `weight` (regular | thin | light | bold | fill | duotone) permet de
// choisir le style selon le contexte. Un seul fichier importe Phosphor, ce qui
// garde le tree-shaking à un seul point et l'abstraction stable côté UI.
import {
  House, MagnifyingGlass, CalendarBlank, BookOpen, Plus, PlusCircle, PencilSimple,
  Trash, DownloadSimple, ShareNetwork, Clock, Fire, Check, FloppyDisk, CaretLeft,
  CaretRight, ArrowUUpLeft, ArrowLeft, CaretUp, CaretDown, X, Copy, TrayArrowDown, LinkSimple,
  ShoppingCartSimple, GearSix, DotsSixVertical, FilePdf, Image, GridFour, ListBullets,
  Sun, SunHorizon, Moon, SignOut, Warning, Flag, Stack, ForkKnife, ShieldCheck, Terminal, Sparkle,
  Star, User, Lightbulb, ArrowSquareOut, Leaf, FileText, EnvelopeSimple, Package,
  WifiSlash, ClockCounterClockwise, Eraser, ArrowsLeftRight, ArrowsDownUp, Pause, Play,
  Stop, DotsThreeVertical, DotsThree, Info, Eye, EyeSlash, Heart, Globe, Lock, Scales,
  AndroidLogo, AppleLogo, Camera, ClipboardText, ArrowClockwise, CircleNotch, Bell,
  Question, Lightning, Knife, BowlSteam, Gift,
} from "@phosphor-icons/react";

// Cuillère (à café / à soupe) : Phosphor n'en fournit pas. Silhouette pleine dans
// le repère 256 de Phosphor pour épouser le poids « regular » du reste du set.
// Volontairement une CUILLÈRE (cuilleron ovale + manche fin), pas une louche.
function Spoon({ size = 20, color = "currentColor", weight, ...rest }) {
  void weight; // le prop de poids Phosphor n'a pas de sens pour ce tracé unique
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color} xmlns="http://www.w3.org/2000/svg" {...rest}>
      {/* Orientée à 135° (cuilleron en haut à gauche, manche vers le bas à droite) */}
      <path transform="rotate(135 128 128)" d="M128 24c-28 0-50 27-50 62 0 27 13 49 33 58v76a17 17 0 0 0 34 0v-76c20-9 33-31 33-58 0-35-22-62-50-62Z" />
    </svg>
  );
}

// Salière : Phosphor n'en fournit pas. Salière PENCHÉE qui verse, dessinée EN
// CONTOUR (corps creux cerné d'un trait, réserve de sel pleine à l'intérieur,
// bouchon plein), grains qui tombent du bec. Le corps est incliné (rotation) ;
// les grains restent posés en bas à gauche (chute), d'où le repère non tourné.
function SaltShaker({ size = 20, color = "currentColor", weight, ...rest }) {
  void weight;
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <g transform="rotate(35 128 128)">
        {/* Coque en contour : extérieur puis intérieur évidé (evenodd) */}
        <path fillRule="evenodd" d="M72 72 Q88 52 128 52 Q168 52 184 72 Q196 84 196 108 L172 176 Q168 188 156 188 L100 188 Q88 188 84 176 L60 108 Q60 84 72 72 Z M88 88 Q100 72 128 72 Q156 72 168 88 Q176 98 176 114 L156 170 Q153 176 147 176 L109 176 Q103 176 100 170 L80 114 Q80 98 88 88 Z" />
        {/* Réserve de sel (à l'intérieur) */}
        <path d="M98 138 Q128 122 158 134 L150 168 Q148 174 142 174 L112 174 Q106 174 104 168 Z" />
        {/* Bouchon : rectangle arrondi détaché du corps (petit espace au-dessus) */}
        <path d="M108 196 L148 196 Q156 196 156 204 L156 210 Q156 218 148 218 L108 218 Q100 218 100 210 L100 204 Q100 196 108 196 Z" />
      </g>
      {/* Grains qui tombent du bec (nombreux, petits, dispersés) */}
      <rect x="60" y="218" width="11" height="11" rx="4" />
      <rect x="84" y="224" width="10" height="10" rx="4" />
      <rect x="48" y="232" width="10" height="10" rx="4" />
      <rect x="72" y="238" width="10" height="10" rx="4" />
      <rect x="56" y="250" width="9" height="9" rx="3" />
      <rect x="80" y="252" width="9" height="9" rx="3" />
      <rect x="64" y="264" width="9" height="9" rx="3" />
    </svg>
  );
}

// Pilon de poulet : Phosphor n'en fournit pas. Symbole universel des protéines,
// dessiné EN CONTOUR (comme la salière) : bulbe de viande en haut à droite avec
// quelques points, os à double bosse en bas à gauche.
function Drumstick({ size = 20, color = "currentColor", weight, ...rest }) {
  void weight;
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" stroke={color} strokeWidth="16" strokeLinejoin="round" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M92 166 C58 150 58 96 94 74 C120 58 168 56 190 84 C212 112 202 156 164 170 C140 178 114 178 92 166 Z" />
      <path d="M96 166 L74 190" />
      <circle cx="60" cy="188" r="13" />
      <circle cx="74" cy="202" r="13" />
      <g fill={color} stroke="none"><circle cx="150" cy="86" r="6" /><circle cx="168" cy="80" r="6" /><circle cx="160" cy="102" r="6" /></g>
    </svg>
  );
}

// name métier -> composant Phosphor.
const ICONS = {
  spoon: Spoon,
  saltShaker: SaltShaker,
  drumstick: Drumstick,
  home: House,
  search: MagnifyingGlass,
  calendar: CalendarBlank,
  book: BookOpen,
  plus: Plus,
  plusCircle: PlusCircle,
  edit: PencilSimple,
  trash: Trash,
  download: DownloadSimple,
  share: ShareNetwork,
  clock: Clock,
  bell: Bell,
  fire: Fire,
  check: Check,
  save: FloppyDisk,
  back: CaretLeft,
  arrowLeft: ArrowLeft,
  forward: CaretRight,
  undo: ArrowUUpLeft,
  chevronUp: CaretUp,
  chevronDown: CaretDown,
  close: X,
  copy: Copy,
  import: TrayArrowDown,
  link: LinkSimple,
  shopping: ShoppingCartSimple,
  settings: GearSix,
  drag: DotsSixVertical,
  pdf: FilePdf,
  photo: Image,
  portions: Scales,
  grid: GridFour,
  list2: ListBullets,
  sun: Sun,
  sunrise: SunHorizon,
  moon: Moon,
  logout: SignOut,
  warning: Warning,
  flag: Flag,
  layers: Stack,
  utensils: ForkKnife,
  shield: ShieldCheck,
  terminal: Terminal,
  sparkle: Sparkle,
  thinking: Sparkle,
  gift: Gift,
  star: Star,
  user: User,
  bulb: Lightbulb,
  externalLink: ArrowSquareOut,
  leaf: Leaf,
  fileText: FileText,
  paste: ClipboardText,
  mail: EnvelopeSimple,
  box: Package,
  wifiOff: WifiSlash,
  history: ClockCounterClockwise,
  eraser: Eraser,
  swap: ArrowsLeftRight,
  updown: ArrowsDownUp,
  pause: Pause,
  play: Play,
  stop: Stop,
  more: DotsThreeVertical,
  ellipsis: DotsThree,
  info: Info,
  eye: Eye,
  eyeOff: EyeSlash,
  heart: Heart,
  globe: Globe,
  lock: Lock,
  android: AndroidLogo,
  apple: AppleLogo,
  camera: Camera,
  refresh: ArrowClockwise,
  spinner: CircleNotch,
  help: Question,
  bolt: Lightning,
  knife: Knife,
  dish: BowlSteam,
};

// Poids par défaut : la plupart des icônes vivent en `regular` (trait épuré) ;
// les affordances qui doivent « peser » (dots de préhension, points d'action,
// transport play/pause/stop) prennent un poids plus marqué. Le prop `weight`
// d'un site d'appel prime toujours.
const DEFAULT_WEIGHT = {
  play: "fill",
  pause: "fill",
  stop: "fill",
  drag: "bold",
  more: "bold",
  ellipsis: "bold",
  check: "bold",
  plus: "bold",
  close: "bold",
};

export const Icon = ({ name, size = 20, color = "currentColor", weight, ...rest }) => {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return <Cmp size={size} color={color} weight={weight ?? DEFAULT_WEIGHT[name] ?? "regular"} {...rest} />;
};
