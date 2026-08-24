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
} from "@phosphor-icons/react";

// name métier -> composant Phosphor.
const ICONS = {
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
