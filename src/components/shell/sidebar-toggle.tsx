"use client";

import { PanelLeft } from "lucide-react";

/** Shows/hides the module sidebar (desktop), remembered per browser. */
export function SidebarToggle() {
  return (
    <button
      type="button"
      aria-label="Toggle sidebar"
      title="Toggle sidebar"
      onClick={() => {
        const d = document.documentElement;
        const collapsed = d.getAttribute("data-sidebar") === "collapsed";
        if (collapsed) d.removeAttribute("data-sidebar");
        else d.setAttribute("data-sidebar", "collapsed");
        try {
          localStorage.setItem("sh-sidebar", collapsed ? "open" : "collapsed");
        } catch {}
      }}
      className="ds-focus hidden h-8 w-8 place-items-center rounded-ds-small text-ds-icon-subtle hover:bg-ds-background-neutral-subtle-hovered lg:grid"
    >
      <PanelLeft size={18} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
