import * as React from "react";
import Link from "next/link";
import { Wrench, Shield, Car, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-lg text-foreground">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Wrench className="size-5" />
            </div>
            <span>Bay<span className="text-primary font-black">Flow</span></span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              Garages & Workshops
            </Link>
            <Link href="/customer" className="transition-colors hover:text-foreground">
              Track My Vehicle
            </Link>
            <Link href="/pos/sa" className="transition-colors hover:text-foreground">
              Shop POS
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/customer"
              className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}
            >
              Customer Sign In
            </Link>
            <Link
              href="/sa"
              className={buttonVariants({ className: "gap-1.5" })}
            >
              Staff POS
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-muted/30 py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 BayFlow Auto Operations Platform. Multi-Tenant Repair POS.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="size-3.5 text-emerald-600" />
              Isolated Tenant Scope
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Car className="size-3.5 text-primary" />
              Live Vehicle Tracker
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
