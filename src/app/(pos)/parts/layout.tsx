import * as React from "react";

export default function PartsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Parts Department & Inventory
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Live stock management, purchase order procurement, and parts allocation to active repairs.
        </p>
      </div>
      {children}
    </div>
  );
}
