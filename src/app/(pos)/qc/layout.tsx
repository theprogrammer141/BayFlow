import * as React from "react";

export default function QcLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Quality Control (QC) Department
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Shared inspection queue, road test verification, pass certification, and defect loop management.
        </p>
      </div>
      {children}
    </div>
  );
}
