import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  BookOpen,
  BookMarked,
  Mail,
  Phone,
  Sparkles,
  ChevronRight,
  Building2,
  Users,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

const homeNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
];

const playbookNavItems = [
  { href: "/playbooks", label: "Playbooks", icon: BookMarked },
  { href: "/intel-hub", label: "Knowledge Base", icon: BookOpen },
];

const outreachNavItems = [
  { href: "/generate-email", label: "Email Writer", icon: Mail },
  { href: "/script-builder", label: "Script Builder", icon: Phone },
  { href: "/suggest-edits", label: "Edit Coach", icon: Sparkles },
];

const hubspotNavItems = [
  { href: "/hubspot/companies", label: "Accounts", icon: Building2 },
  { href: "/hubspot/contacts", label: "Contacts", icon: Users },
  { href: "/travel", label: "Travel Planner", icon: MapPin },
];

function NavGroup({ label, items }: { label: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] }) {
  const [location] = useLocation();
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest">
        {label}
      </p>
      {items.map(({ href, label: itemLabel, icon: Icon }) => {
        const active = href === "/" ? location === "/" : location.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            data-testid={`nav-${itemLabel.toLowerCase().replace(/\s+/g, "-")}`}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {itemLabel}
          </Link>
        );
      })}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="flex flex-col w-56 shrink-0 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
          <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center shrink-0">
            <ChevronRight className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sidebar-foreground font-semibold text-sm tracking-tight leading-tight">
            PCI AI<br />
            <span className="font-normal text-sidebar-foreground/60">Playmaker</span>
          </span>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          <NavGroup label="Home" items={homeNavItems} />
          <NavGroup label="Playbooks" items={playbookNavItems} />
          <NavGroup label="Outreach" items={outreachNavItems} />
          <NavGroup label="HubSpot CRM" items={hubspotNavItems} />
        </nav>

        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/40">PCI AI Playmaker</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
