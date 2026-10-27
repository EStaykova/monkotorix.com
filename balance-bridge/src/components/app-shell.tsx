import { Outlet, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Toaster } from "@/components/ui/sonner";

// App frame: skip link, a quiet top bar with the app identity, and one <main>.
// Game controls (theme, bridge level, settings) live on the page itself.
export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#bridge-work"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to the puzzle
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <svg viewBox="0 0 40 28" className="h-7 w-10" aria-hidden="true">
            <path d="M20 14 L13 26 H27 Z" className="fill-primary" />
            <rect x="2" y="10" width="36" height="4" rx="2" className="fill-foreground" />
            <rect x="5" y="4" width="6" height="6" rx="1.5" className="fill-primary" />
            <rect x="29" y="4" width="6" height="6" rx="1.5" className="fill-primary" />
          </svg>
          <span className="text-lg font-semibold tracking-tight">Balance Bridge</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="flex-1"
        >
          <Outlet />
        </motion.div>
      </main>
      <Toaster />
    </div>
  );
}

export default AppShell;
