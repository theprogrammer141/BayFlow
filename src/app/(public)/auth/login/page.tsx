"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wrench,
  Shield,
  ArrowRight,
  AlertCircle,
  Package,
  CheckCircle2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiClientError } from "@/lib/api-client";

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    isCustomer: boolean;
    memberships: Array<{
      shopId: string;
      role: string;
    }>;
  };
  token: string;
}

const DEMO_PRESETS = [
  { role: "Parts Specialist", email: "parts@bayflow.demo", target: "/parts", icon: Package },
  { role: "Technician", email: "tech@bayflow.demo", target: "/technician", icon: Wrench },
  { role: "Service Advisor", email: "sa@bayflow.demo", target: "/sa", icon: Users },
  { role: "Shop Owner", email: "owner@bayflow.demo", target: "/owner", icon: Shield },
  { role: "QC Inspector", email: "qc@bayflow.demo", target: "/qc", icon: CheckCircle2 },
  { role: "Customer", email: "customer@bayflow.demo", target: "/customer", icon: Wrench },
];

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const [email, setEmail] = React.useState("parts@bayflow.demo");
  const [password, setPassword] = React.useState("password123");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleLogin(targetEmail = email, targetPass = password, customRedirect?: string) {
    try {
      setIsLoading(true);
      setError(null);

      const res = await apiClient<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: targetEmail.trim(),
          password: targetPass,
        }),
      });

      if (customRedirect) {
        router.push(customRedirect);
        return;
      }

      if (redirectParam) {
        router.push(redirectParam);
        return;
      }

      // Default role routing
      const primaryRole = res.user.memberships?.[0]?.role;
      if (primaryRole === "PARTS_PERSON") {
        router.push("/parts");
      } else if (primaryRole === "TECHNICIAN") {
        router.push("/technician");
      } else if (primaryRole === "SERVICE_ADVISOR") {
        router.push("/sa");
      } else if (primaryRole === "OWNER") {
        router.push("/owner");
      } else if (primaryRole === "QC_INSPECTOR") {
        router.push("/qc");
      } else {
        router.push("/customer");
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Invalid email or password");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleQuickPreset(preset: typeof DEMO_PRESETS[0]) {
    setEmail(preset.email);
    setPassword("password123");
    void handleLogin(preset.email, "password123", preset.target);
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1.5">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Wrench className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sign in to BayFlow
          </h1>
          <p className="text-xs text-muted-foreground">
            Access multi-tenant shop POS dashboards or customer portal.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleLogin();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full text-xs font-semibold gap-1.5"
            >
              {isLoading ? "Signing in..." : "Sign in to Dashboard"}
              <ArrowRight className="size-3.5" />
            </Button>
          </form>

          <div className="space-y-2.5 pt-3 border-t border-border/70">
            <p className="text-[11px] font-semibold text-muted-foreground text-center">
              Quick One-Click Demo Logins
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <Button
                    key={preset.role}
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={isLoading}
                    onClick={() => handleQuickPreset(preset)}
                    className="h-8 justify-start gap-1.5 text-[11px] font-medium"
                  >
                    <Icon className="size-3 text-primary shrink-0" />
                    <span className="truncate">{preset.role}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Default password for all seeded demo accounts is <span className="font-mono text-foreground">password123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
          <div className="text-center text-xs text-muted-foreground">
            Loading...
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </React.Suspense>
  );
}

