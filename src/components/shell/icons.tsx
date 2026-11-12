import {
  CalendarClock, Database, Headset, LayoutDashboard, PackageCheck, PhoneMissed, RotateCcw,
  Search, Settings, Ticket, Truck, Undo2, Users, type LucideProps,
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
