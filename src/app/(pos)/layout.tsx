import * as React from "react";
import Link from "next/link";
import {
  Wrench,
  Users,
  Package,
  ShieldCheck,
  Building2,
  Bell,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b border-border bg-background shadow-xs">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-lg text-foreground">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Wrench className="size-4" />
              </div>
              <span>Bay<span className="text-primary font-black">Flow</span></span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                POS
              </span>
            </Link>

            <div className="hidden lg:flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs">
              <Building2 className="size-3.5 text-muted-foreground" />
              <span className="font-semibold text-foreground">Apex Auto Works</span>
              <span className="text-muted-foreground">(Karachi Branch)</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/sa"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Users className="size-3.5" />
              Service Advisor
            </Link>
            <Link
              href="/technician"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Wrench className="size-3.5" />
              Technician
            </Link>
            <Link
              href="/parts"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Package className="size-3.5" />
              Parts & Stock
            </Link>
            <Link
              href="/qc"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ShieldCheck className="size-3.5" />
              QC Inspector
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground">
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
            </Button>
            <div className="flex items-center gap-2 border-l border-border pl-3 text-xs">
              <UserCheck className="size-4 text-emerald-600" />
              <span className="font-medium text-foreground hidden sm:inline">Shop Staff</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
