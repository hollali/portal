import { FileText, Mic, MessagesSquare, ScrollText, type LucideIcon } from 'lucide-react'

export const KIND_ICON: Record<string, LucideIcon> = {
  speech: Mic,
  paper: FileText,
  interview: MessagesSquare,
  note: ScrollText,
  letter: ScrollText,
  memo: ScrollText,
}
