import * as React from "react";

export default function TechnicianLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Technician Workbench
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Assigned repair jobs, vehicle inspections, estimate draft composition, and QC submissions.
        </p>
      </div>
      {children}
    </div>
  );
}
