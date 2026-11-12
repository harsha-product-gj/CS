import { requireUser } from "@/lib/auth";
import { appsFor } from "@/lib/nav";
import { TopBar } from "@/components/shell/top-bar";
import { AppRail, BottomTabs, ModuleNav } from "@/components/shell/side-nav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const apps = appsFor(user.roles);
  return (
    <div className="flex h-dvh flex-col">
      <TopBar user={user} />
      <div className="flex min-h-0 flex-1">
        <AppRail apps={apps} />
        <ModuleNav apps={apps} variant="sidebar" />
        <main className="min-w-0 flex-1 overflow-y-auto bg-ds-surface-sunken">
          <div className="w-full max-w-7xl px-4 pt-4 pb-24 md:px-6 md:py-6">
            <ModuleNav apps={apps} variant="tabs" />
            {children}
          </div>
        </main>
      </div>
      <BottomTabs apps={apps} />
    </div>
  );
}
