import {
  CalendarClock, CalendarDays, Database, ShieldCheck, UserRoundCog, Headset, LayoutDashboard, PackageCheck, PhoneMissed, RotateCcw,
  Search, Settings, Ticket, Tickets, Timer, Truck, Undo2, Users, type LucideProps,
} from "lucide-react";
import type { IconName } from "@/lib/nav";

const MAP: Record<IconName, React.ComponentType<LucideProps>> = {
  support: Headset,
  operations: Truck,
  insights: LayoutDashboard,
  admin: Settings,
  search: Search,
  tickets: Ticket,
  followups: CalendarClock,
  alltickets: Tickets,
  sla: Timer,
  roster: CalendarDays,
  cover: UserRoundCog,
  approvals: ShieldCheck,
  missed: PhoneMissed,
  resolutions: RotateCcw,
  pickups: Undo2,
  dispatches: PackageCheck,
  dashboard: LayoutDashboard,
  users: Users,
  data: Database,
};

export function NavIcon({ name, size = 16 }: { name: IconName; size?: number }) {
  const I = MAP[name];
  return <I size={size} strokeWidth={1.75} aria-hidden />;
}
