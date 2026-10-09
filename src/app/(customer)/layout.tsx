"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, ArrowLeft, UserCircle, LogOut } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { AuthUser } from "@/lib/auth/types";

export default function CustomerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [user, setUser] = React.useState<AuthUser | null>(null);

  React.useEffect(() => {
    async function loadUser() {
      try {
        const res = await apiClient<{ user: AuthUser }>("/api/auth/me");
        if (res?.user) {
          setUser(res.user);
        }
      } catch {
        setUser(null);
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue logout redirect regardless
    }
    setUser(null);
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Workshop Directory</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Car className="size-4" />
              </div>
              <span className="font-bold text-sm text-foreground">Customer Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <UserCircle className="size-5 text-muted-foreground" />
                <span className="hidden sm:inline font-semibold">{user.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Sign out"
                  className="size-8 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="size-3.5" />
                </Button>
              </div>
            ) : (
              <Link
                href="/book"
                className={buttonVariants({ variant: "outline", size: "sm", className: "text-xs" })}
              >
                Book Appointment
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
