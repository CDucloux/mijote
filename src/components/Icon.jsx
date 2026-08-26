// ─── ICONS ────────────────────────────────────────────────────────────────────
// Fine façade au-dessus de Phosphor : les sites d'appel restent <Icon name="…" />,
// le prop `weight` (regular | thin | light | bold | fill | duotone) permet de
// choisir le style selon le contexte. Un seul fichier importe Phosphor, ce qui
// garde le tree-shaking à un seul point et l'abstraction stable côté UI.
import {
  House, MagnifyingGlass, CalendarBlank, BookOpen, Plus, PlusCircle, PencilSimple,
  Trash, DownloadSimple, ShareNetwork, Clock, Fire, Check, FloppyDisk, CaretLeft,
  CaretRight, ArrowUUpLeft, CaretUp, CaretDown, X, Copy, TrayArrowDown, LinkSimple,
  ShoppingCartSimple, GearSix, DotsSixVertical, FilePdf, Image, GridFour, ListBullets,
  Sun, Moon, SignOut, Warning, Flag, Stack, ForkKnife, ShieldCheck, Terminal, Sparkle,
  Star, User, Lightbulb, ArrowSquareOut, Leaf, FileText, EnvelopeSimple, Package,
  WifiSlash, ClockCounterClockwise, Eraser, ArrowsLeftRight, ArrowsDownUp, Pause, Play,
  Stop, DotsThreeVertical, DotsThree, Info, Eye, EyeSlash, Heart, Globe, Lock, Scales,
  AndroidLogo, AppleLogo, Camera,
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

// name métier -> composant Phosphor.
const ICONS = {
  spoon: Spoon,
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
  fire: Fire,
  check: Check,
  save: FloppyDisk,
  back: CaretLeft,
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
  star: Star,
  user: User,
  bulb: Lightbulb,
  externalLink: ArrowSquareOut,
  leaf: Leaf,
  fileText: FileText,
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
