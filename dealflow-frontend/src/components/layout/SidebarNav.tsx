import { NavLink } from "react-router-dom";

export type NavItem = { label: string; to: string };

export type SidebarNavProps = {
  items: NavItem[];
};

export function SidebarNav({ items }: SidebarNavProps) {
  return (
    <nav className="w-full text-sm text-white">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "neon-glass flex items-center justify-between px-4 py-3 font-semibold transition-all rounded-xl",
                  isActive
                    ? "active-nav text-white"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                ].join(" ")
              }
            >
              <span className="tracking-wide">{item.label}</span>

              <span
                aria-hidden
                className="h-2 w-2 rounded-full transition-all"
                style={{
                  background: isActive
                    ? "var(--neon-red)"
                    : "rgba(255,255,255,0.3)",
                  boxShadow: isActive
                    ? "0 0 8px rgba(255,0,80,0.6)"
                    : "none"
                }}
              />
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}


