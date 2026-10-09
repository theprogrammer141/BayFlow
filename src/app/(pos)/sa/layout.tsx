import * as React from "react";

export default function SaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Service Advisor Desk
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Intake check-ins, technician assignments, estimate reviews, and customer delivery.
        </p>
      </div>
      {children}
    </div>
  );
}
