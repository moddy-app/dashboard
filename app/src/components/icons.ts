/**
 * Barrel UNIQUE des icônes du dashboard — Material Symbols Rounded, variante PLEINE.
 *
 * Règles :
 *  - Source : `@iconify-json/material-symbols` via `unplugin-icons` (compilé en composants
 *    React SVG au build : aucune police d'icônes, aucun CDN).
 *  - Style : uniquement les noms `material-symbols:<nom>-rounded` (plein). Jamais
 *    `-outline`, `-outline-rounded` ni `-sharp`.
 *  - Toute icône de l'UI s'importe d'ici (`@/components/icons`), jamais directement
 *    depuis `~icons/…`, `lucide-react` ou `@hugeicons/*`.
 *  - Une seule déclaration par icône source ; les alias (noms lucide) ne font que
 *    ré-exporter la déclaration canonique.
 *  - Pour ajouter une icône : vérifier le nom dans
 *    node_modules/@iconify-json/material-symbols/icons.json, puis ajouter l'import
 *    et l'export en respectant l'ordre alphabétique.
 */
import type { ComponentType, SVGProps } from 'react'

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

// ---------------------------------------------------------------------------
// Imports (noms canoniques)
// ---------------------------------------------------------------------------
import AddCircleIcon from '~icons/material-symbols/add-circle-rounded'
import AddCommentIcon from '~icons/material-symbols/add-comment-rounded'
import AddIcon from '~icons/material-symbols/add-rounded'
import AllInclusiveIcon from '~icons/material-symbols/all-inclusive-rounded'
import AlternateEmailIcon from '~icons/material-symbols/alternate-email-rounded'
import ArchiveIcon from '~icons/material-symbols/archive-rounded'
import ArrowBackIcon from '~icons/material-symbols/arrow-back-rounded'
import ArrowForwardIcon from '~icons/material-symbols/arrow-forward-rounded'
import ArrowUpwardIcon from '~icons/material-symbols/arrow-upward-rounded'
import AssignmentIcon from '~icons/material-symbols/assignment-rounded'
import AutoAwesomeIcon from '~icons/material-symbols/auto-awesome-rounded'
import BackHandIcon from '~icons/material-symbols/back-hand-rounded'
import BalanceIcon from '~icons/material-symbols/balance-rounded'
import BarChartIcon from '~icons/material-symbols/bar-chart-rounded'
import BlockIcon from '~icons/material-symbols/block-rounded'
import BluetoothIcon from '~icons/material-symbols/bluetooth-rounded'
import BoltIcon from '~icons/material-symbols/bolt-rounded'
import BugReportIcon from '~icons/material-symbols/bug-report-rounded'
import BuildIcon from '~icons/material-symbols/build-rounded'
import CalendarMonthIcon from '~icons/material-symbols/calendar-month-rounded'
import CampaignIcon from '~icons/material-symbols/campaign-rounded'
import CancelIcon from '~icons/material-symbols/cancel-rounded'
import ChatBubbleIcon from '~icons/material-symbols/chat-bubble-rounded'
import CheckBoxIcon from '~icons/material-symbols/check-box-rounded'
import CheckCircleIcon from '~icons/material-symbols/check-circle-rounded'
import CheckIcon from '~icons/material-symbols/check-rounded'
import ChevronDownIcon from '~icons/material-symbols/keyboard-arrow-down-rounded'
import ChevronLeftIcon from '~icons/material-symbols/chevron-left-rounded'
import ChevronRightIcon from '~icons/material-symbols/chevron-right-rounded'
import ChevronUpIcon from '~icons/material-symbols/keyboard-arrow-up-rounded'
import CircleIcon from '~icons/material-symbols/circle-rounded'
import CloseIcon from '~icons/material-symbols/close-rounded'
import CloudOffIcon from '~icons/material-symbols/cloud-off-rounded'
import CodeIcon from '~icons/material-symbols/code-rounded'
import ConfirmationNumberIcon from '~icons/material-symbols/confirmation-number-rounded'
import ContentCutIcon from '~icons/material-symbols/content-cut-rounded'
import CopyIcon from '~icons/material-symbols/content-copy-rounded'
import CreditCardIcon from '~icons/material-symbols/credit-card-rounded'
import CrownIcon from '~icons/material-symbols/crown-rounded'
import DarkModeIcon from '~icons/material-symbols/dark-mode-rounded'
import DashboardIcon from '~icons/material-symbols/dashboard-rounded'
import DeleteIcon from '~icons/material-symbols/delete-rounded'
import DescriptionIcon from '~icons/material-symbols/description-rounded'
import DiscordIcon from '~icons/material-symbols/sports-esports-rounded' // PAS d'équivalent Material : manette en repli, à remplacer par un logo de marque inline si besoin
import DnsIcon from '~icons/material-symbols/dns-rounded'
import DoneAllIcon from '~icons/material-symbols/done-all-rounded'
import DoNotDisturbIcon from '~icons/material-symbols/do-not-disturb-on-rounded'
import DoorOpenIcon from '~icons/material-symbols/door-open-rounded'
import DownloadIcon from '~icons/material-symbols/download-rounded'
import DraftIcon from '~icons/material-symbols/draft-rounded'
import DragIndicatorIcon from '~icons/material-symbols/drag-indicator-rounded'
import EditIcon from '~icons/material-symbols/edit-rounded'
import ErrorIcon from '~icons/material-symbols/error-rounded'
import ExtensionPuzzleIcon from '~icons/material-symbols/extension-rounded'
import FilterListIcon from '~icons/material-symbols/filter-list-rounded'
import FindInPageIcon from '~icons/material-symbols/find-in-page-rounded'
import FolderIcon from '~icons/material-symbols/folder-rounded'
import FolderOffIcon from '~icons/material-symbols/folder-off-rounded'
import FolderOpenIcon from '~icons/material-symbols/folder-open-rounded'
import FormatBoldIcon from '~icons/material-symbols/format-bold-rounded'
import FormatH2Icon from '~icons/material-symbols/format-h2-rounded'
import FormatItalicIcon from '~icons/material-symbols/format-italic-rounded'
import FormatQuoteIcon from '~icons/material-symbols/format-quote-rounded'
import FormatStrikethroughIcon from '~icons/material-symbols/format-strikethrough-rounded'
import ForumIcon from '~icons/material-symbols/forum-rounded'
import GavelIcon from '~icons/material-symbols/gavel-rounded'
import GroupIcon from '~icons/material-symbols/group-rounded'
import HelpIcon from '~icons/material-symbols/help-rounded'
// Pas de variante -rounded pour fingerprint dans Material Symbols : version pleine standard.
import FingerprintIcon from '~icons/material-symbols/fingerprint'
import HistoryEduIcon from '~icons/material-symbols/history-edu-rounded'
import HistoryIcon from '~icons/material-symbols/history-rounded'
import HomeIcon from '~icons/material-symbols/home-rounded'
import HourglassIcon from '~icons/material-symbols/hourglass-top-rounded'
import HowToRegIcon from '~icons/material-symbols/how-to-reg-rounded'
import ImageIcon from '~icons/material-symbols/image-rounded'
import InboxIcon from '~icons/material-symbols/inbox-rounded'
import InfoIcon from '~icons/material-symbols/info-rounded'
import InkEraserIcon from '~icons/material-symbols/ink-eraser-rounded'
import KeepIcon from '~icons/material-symbols/keep-rounded'
import KeyboardIcon from '~icons/material-symbols/keyboard-rounded'
import KeyIcon from '~icons/material-symbols/key-rounded'
import LanguageIcon from '~icons/material-symbols/language-rounded'
import LayersIcon from '~icons/material-symbols/layers-rounded'
import LeftPanelOpenIcon from '~icons/material-symbols/left-panel-open-rounded'
import LibraryBooksIcon from '~icons/material-symbols/library-books-rounded'
import LightModeIcon from '~icons/material-symbols/light-mode-rounded'
import LinkIcon from '~icons/material-symbols/link-rounded'
import LockIcon from '~icons/material-symbols/lock-rounded'
import LockOpenIcon from '~icons/material-symbols/lock-open-rounded'
import LoginIcon from '~icons/material-symbols/login-rounded'
import LogoutIcon from '~icons/material-symbols/logout-rounded'
import MailIcon from '~icons/material-symbols/mail-rounded'
import MailOffIcon from '~icons/material-symbols/mail-off-rounded'
import ManageAccountsIcon from '~icons/material-symbols/manage-accounts-rounded'
import MemoryChipIcon from '~icons/material-symbols/memory-rounded'
import MenuBookIcon from '~icons/material-symbols/menu-book-rounded'
import MicOffIcon from '~icons/material-symbols/mic-off-rounded'
import MonitorHeartIcon from '~icons/material-symbols/monitor-heart-rounded'
import MonitorIcon from '~icons/material-symbols/monitor-rounded'
import MoreHorizIcon from '~icons/material-symbols/more-horiz-rounded'
import MoreVertIcon from '~icons/material-symbols/more-vert-rounded'
import MusicNoteIcon from '~icons/material-symbols/music-note-rounded'
import NorthEastIcon from '~icons/material-symbols/north-east-rounded'
import NotificationsActiveIcon from '~icons/material-symbols/notifications-active-rounded'
import NotificationsIcon from '~icons/material-symbols/notifications-rounded'
import OpenInNewIcon from '~icons/material-symbols/open-in-new-rounded'
import PaletteIcon from '~icons/material-symbols/palette-rounded'
import PauseIcon from '~icons/material-symbols/pause-rounded'
import PersonAddIcon from '~icons/material-symbols/person-add-rounded'
import PersonIcon from '~icons/material-symbols/person-rounded'
import PersonSearchIcon from '~icons/material-symbols/person-search-rounded'
import PlayIcon from '~icons/material-symbols/play-arrow-rounded'
import PodcastsIcon from '~icons/material-symbols/podcasts-rounded'
import ProgressActivityIcon from '~icons/material-symbols/progress-activity-rounded'
import RadioButtonCheckedIcon from '~icons/material-symbols/radio-button-checked-rounded'
import ReceiptLongIcon from '~icons/material-symbols/receipt-long-rounded'
import RefreshIcon from '~icons/material-symbols/refresh-rounded'
import RemoveIcon from '~icons/material-symbols/remove-rounded'
import ReportIcon from '~icons/material-symbols/report-rounded'
import RocketLaunchIcon from '~icons/material-symbols/rocket-launch-rounded'
import RotateLeftIcon from '~icons/material-symbols/rotate-left-rounded'
import SaveIcon from '~icons/material-symbols/save-rounded'
import ScheduleIcon from '~icons/material-symbols/schedule-rounded'
import ScienceIcon from '~icons/material-symbols/science-rounded'
import SearchIcon from '~icons/material-symbols/search-rounded'
import SendIcon from '~icons/material-symbols/send-rounded'
import SensorsIcon from '~icons/material-symbols/sensors-rounded'
import SentimentSatisfiedIcon from '~icons/material-symbols/sentiment-satisfied-rounded'
import SettingsIcon from '~icons/material-symbols/settings-rounded'
import ShareIcon from '~icons/material-symbols/share-rounded'
import ShieldAlertIcon from '~icons/material-symbols/gpp-maybe-rounded'
import ShieldCheckIcon from '~icons/material-symbols/verified-user-rounded'
import ShieldIcon from '~icons/material-symbols/shield-rounded'
import ShieldMinusIcon from '~icons/material-symbols/remove-moderator-rounded'
import ShieldQuestionIcon from '~icons/material-symbols/shield-question-rounded'
import ShowChartIcon from '~icons/material-symbols/show-chart-rounded'
import SmartToyIcon from '~icons/material-symbols/smart-toy-rounded'
import SpeedIcon from '~icons/material-symbols/speed-rounded'
import StarIcon from '~icons/material-symbols/star-rounded'
import SupportIcon from '~icons/material-symbols/support-rounded'
import TagIcon from '~icons/material-symbols/tag-rounded'
import TerminalIcon from '~icons/material-symbols/terminal-rounded'
import TextFieldsIcon from '~icons/material-symbols/text-fields-rounded'
import ThumbDownIcon from '~icons/material-symbols/thumb-down-rounded'
import TimerIcon from '~icons/material-symbols/timer-rounded'
import TimerOffIcon from '~icons/material-symbols/timer-off-rounded'
import TollIcon from '~icons/material-symbols/toll-rounded'
import TranslateIcon from '~icons/material-symbols/translate-rounded'
import TrendingDownIcon from '~icons/material-symbols/trending-down-rounded'
import TrendingUpIcon from '~icons/material-symbols/trending-up-rounded'
import TuneIcon from '~icons/material-symbols/tune-rounded'
import UndoIcon from '~icons/material-symbols/undo-rounded'
import UnfoldMoreIcon from '~icons/material-symbols/unfold-more-rounded'
import UnknownDocumentIcon from '~icons/material-symbols/unknown-document-rounded'
import UploadIcon from '~icons/material-symbols/upload-rounded'
import VideocamIcon from '~icons/material-symbols/videocam-rounded'
import VolumeUpIcon from '~icons/material-symbols/volume-up-rounded'
import ViewQuiltIcon from '~icons/material-symbols/view-quilt-rounded'
import VisibilityIcon from '~icons/material-symbols/visibility-rounded'
import VisibilityOffIcon from '~icons/material-symbols/visibility-off-rounded'
import WandStarsIcon from '~icons/material-symbols/wand-stars-rounded'
import WarningIcon from '~icons/material-symbols/warning-rounded'
import WebAssetIcon from '~icons/material-symbols/web-asset-rounded'
import WifiOffIcon from '~icons/material-symbols/wifi-off-rounded'

// ---------------------------------------------------------------------------
// Exports canoniques (ordre alphabétique)
// ---------------------------------------------------------------------------
export {
  AddCircleIcon,
  AddCommentIcon,
  AddIcon,
  AllInclusiveIcon,
  AlternateEmailIcon,
  ArchiveIcon,
  ArrowBackIcon,
  ArrowForwardIcon,
  ArrowUpwardIcon,
  AssignmentIcon,
  AutoAwesomeIcon,
  BackHandIcon,
  BalanceIcon,
  BarChartIcon,
  BlockIcon,
  BluetoothIcon,
  BoltIcon,
  BugReportIcon,
  BuildIcon,
  CalendarMonthIcon,
  CampaignIcon,
  CancelIcon,
  ChatBubbleIcon,
  CheckBoxIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleIcon,
  CloseIcon,
  CloudOffIcon,
  CodeIcon,
  ConfirmationNumberIcon,
  ContentCutIcon,
  CopyIcon,
  CreditCardIcon,
  CrownIcon,
  DarkModeIcon,
  DashboardIcon,
  DeleteIcon,
  DescriptionIcon,
  DiscordIcon,
  DnsIcon,
  DoneAllIcon,
  DoNotDisturbIcon,
  DoorOpenIcon,
  DownloadIcon,
  DraftIcon,
  DragIndicatorIcon,
  EditIcon,
  ErrorIcon,
  ExtensionPuzzleIcon,
  FilterListIcon,
  FindInPageIcon,
  FolderIcon,
  FolderOffIcon,
  FolderOpenIcon,
  FormatBoldIcon,
  FormatH2Icon,
  FormatItalicIcon,
  FormatQuoteIcon,
  FormatStrikethroughIcon,
  ForumIcon,
  GavelIcon,
  GroupIcon,
  HelpIcon,
  FingerprintIcon,
  HistoryEduIcon,
  HistoryIcon,
  HomeIcon,
  HourglassIcon,
  HowToRegIcon,
  ImageIcon,
  InboxIcon,
  InfoIcon,
  InkEraserIcon,
  KeepIcon,
  KeyboardIcon,
  KeyIcon,
  LanguageIcon,
  LayersIcon,
  LeftPanelOpenIcon,
  LibraryBooksIcon,
  LightModeIcon,
  LinkIcon,
  LockIcon,
  LockOpenIcon,
  LoginIcon,
  LogoutIcon,
  MailIcon,
  MailOffIcon,
  ManageAccountsIcon,
  MemoryChipIcon,
  MenuBookIcon,
  MicOffIcon,
  MonitorHeartIcon,
  MonitorIcon,
  MoreHorizIcon,
  MoreVertIcon,
  MusicNoteIcon,
  NorthEastIcon,
  NotificationsActiveIcon,
  NotificationsIcon,
  OpenInNewIcon,
  PaletteIcon,
  PauseIcon,
  PersonAddIcon,
  PersonIcon,
  PersonSearchIcon,
  PlayIcon,
  PodcastsIcon,
  ProgressActivityIcon,
  RadioButtonCheckedIcon,
  ReceiptLongIcon,
  RefreshIcon,
  RemoveIcon,
  ReportIcon,
  RocketLaunchIcon,
  RotateLeftIcon,
  SaveIcon,
  ScheduleIcon,
  ScienceIcon,
  SearchIcon,
  SendIcon,
  SensorsIcon,
  SentimentSatisfiedIcon,
  SettingsIcon,
  ShareIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldIcon,
  ShieldMinusIcon,
  ShieldQuestionIcon,
  ShowChartIcon,
  SmartToyIcon,
  SpeedIcon,
  StarIcon,
  SupportIcon,
  TagIcon,
  TerminalIcon,
  TextFieldsIcon,
  ThumbDownIcon,
  TimerIcon,
  TimerOffIcon,
  TollIcon,
  TranslateIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TuneIcon,
  UndoIcon,
  UnfoldMoreIcon,
  UnknownDocumentIcon,
  UploadIcon,
  VideocamIcon,
  VolumeUpIcon,
  ViewQuiltIcon,
  VisibilityIcon,
  VisibilityOffIcon,
  WandStarsIcon,
  WarningIcon,
  WebAssetIcon,
  WifiOffIcon,
}

// ---------------------------------------------------------------------------
// Alias aux noms lucide-react (migration sans renommage en masse).
// Préférer le nom canonique dans le code neuf.
// ---------------------------------------------------------------------------
export {
  MonitorHeartIcon as ActivityIcon,
  ErrorIcon as AlertCircleIcon,
  ReportIcon as AlertOctagonIcon,
  WarningIcon as AlertTriangleIcon,
  FolderOffIcon as ArchiveXIcon,
  ArrowBackIcon as ArrowLeftIcon,
  ArrowForwardIcon as ArrowRightIcon,
  ArrowUpwardIcon as ArrowUpIcon,
  NorthEastIcon as ArrowUpRightIcon,
  AlternateEmailIcon as AtSignIcon,
  BlockIcon as BanIcon,
  NotificationsIcon as BellIcon,
  NotificationsActiveIcon as BellRingIcon,
  FormatBoldIcon as BoldIcon,
  MenuBookIcon as BookOpenIcon,
  SmartToyIcon as BotIcon,
  BugReportIcon as BugIcon,
  CalendarMonthIcon as CalendarIcon,
  ShowChartIcon as ChartLineIcon,
  DoneAllIcon as CheckCheckIcon,
  CheckCircleIcon as CheckCircle2Icon,
  CheckBoxIcon as CheckSquareIcon,
  UnfoldMoreIcon as ChevronsUpDownIcon,
  ErrorIcon as CircleAlertIcon,
  RadioButtonCheckedIcon as CircleDotIcon,
  AssignmentIcon as ClipboardListIcon,
  ScheduleIcon as ClockIcon,
  TollIcon as CoinsIcon,
  MemoryChipIcon as CpuIcon,
  InkEraserIcon as EraserIcon,
  OpenInNewIcon as ExternalLinkIcon,
  VisibilityIcon as EyeIcon,
  VisibilityOffIcon as EyeOffIcon,
  HistoryEduIcon as FileClockIcon,
  CodeIcon as FileCodeIcon,
  SettingsIcon as FileCogIcon,
  DraftIcon as FileIcon,
  FindInPageIcon as FileSearch2Icon,
  DescriptionIcon as FileTextIcon,
  UnknownDocumentIcon as FileWarningIcon,
  ScienceIcon as FlaskConicalIcon,
  FindInPageIcon as FolderSearchIcon,
  SpeedIcon as GaugeIcon,
  LanguageIcon as GlobeIcon,
  DragIndicatorIcon as GripVerticalIcon,
  BackHandIcon as HandIcon,
  TagIcon as HashIcon,
  FormatH2Icon as Heading2Icon,
  HelpIcon as HelpCircleIcon,
  AllInclusiveIcon as InfinityIcon,
  FormatItalicIcon as ItalicIcon,
  KeyIcon as KeyRoundIcon,
  TranslateIcon as LanguagesIcon,
  DashboardIcon as LayoutDashboardIcon,
  ViewQuiltIcon as LayoutIcon,
  WebAssetIcon as LayoutPanelTopIcon,
  LibraryBooksIcon as LibraryIcon,
  SupportIcon as LifeBuoyIcon,
  FilterListIcon as ListFilterIcon,
  ProgressActivityIcon as Loader2Icon,
  ProgressActivityIcon as LoaderIcon,
  LoginIcon as LogInIcon,
  LogoutIcon as LogOutIcon,
  MailOffIcon as MailXIcon,
  CampaignIcon as MegaphoneIcon,
  ChatBubbleIcon as MessageSquareIcon,
  AddCommentIcon as MessageSquarePlusIcon,
  FormatQuoteIcon as MessageSquareQuoteIcon,
  ForumIcon as MessagesSquareIcon,
  DoNotDisturbIcon as MinusCircleIcon,
  RemoveIcon as MinusIcon,
  DarkModeIcon as MoonIcon,
  MoreHorizIcon as MoreHorizontalIcon,
  MoreVertIcon as MoreVerticalIcon,
  MusicNoteIcon as MusicIcon,
  ReportIcon as OctagonAlertIcon,
  LeftPanelOpenIcon as PanelLeftIcon,
  EditIcon as PencilIcon,
  KeepIcon as PinIcon,
  AddCircleIcon as PlusCircleIcon,
  AddIcon as PlusIcon,
  ExtensionPuzzleIcon as PuzzleIcon,
  SensorsIcon as RadioIcon,
  RefreshIcon as RefreshCwIcon,
  RocketLaunchIcon as RocketIcon,
  RotateLeftIcon as RotateCcwIcon,
  BalanceIcon as ScaleIcon,
  ContentCutIcon as ScissorsIcon,
  ReceiptLongIcon as ScrollTextIcon,
  SendIcon as SendHorizonalIcon,
  CloudOffIcon as ServerCrashIcon,
  DnsIcon as ServerIcon,
  TuneIcon as Settings2Icon,
  SentimentSatisfiedIcon as SmileIcon,
  AutoAwesomeIcon as SparkleIcon,
  AutoAwesomeIcon as SparklesIcon,
  FormatStrikethroughIcon as StrikethroughIcon,
  LightModeIcon as SunIcon,
  TextFieldsIcon as TextIcon,
  ThumbDownIcon as ThumbsDownIcon,
  ConfirmationNumberIcon as TicketIcon,
  DeleteIcon as Trash2Icon,
  DeleteIcon as TrashIcon,
  WarningIcon as TriangleAlertIcon,
  LockOpenIcon as UnlockIcon,
  HowToRegIcon as UserCheckIcon,
  ManageAccountsIcon as UserCogIcon,
  PersonIcon as UserIcon,
  PersonAddIcon as UserPlusIcon,
  PersonSearchIcon as UserSearchIcon,
  GroupIcon as UsersIcon,
  VideocamIcon as VideoIcon,
  WandStarsIcon as WandSparklesIcon,
  BuildIcon as WrenchIcon,
  CancelIcon as XCircleIcon,
  CloseIcon as XIcon,
  BoltIcon as ZapIcon,
}
