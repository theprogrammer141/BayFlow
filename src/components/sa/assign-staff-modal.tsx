"use client";

import * as React from "react";
import { Wrench, Package, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { TeamMember } from "@/lib/contracts/shop";

interface AssignStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  bookingId: string;
  role: "TECHNICIAN" | "PARTS_PERSON";
  onSuccess: () => void;
}

export function AssignStaffModal({
  isOpen,
  onClose,
  shopId,
  bookingId,
  role,
  onSuccess,
}: AssignStaffModalProps) {
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !shopId) return;

    let mounted = true;

    async function fetchStaff() {
      try {
        setIsLoading(true);
        setError(null);
        const members = await apiClient<TeamMember[]>(`/api/shops/${shopId}/team`);
        if (mounted) {
          const filtered = members.filter(
            (m) => m.role === role && m.isActive
          );
          setTeamMembers(filtered);
          if (filtered.length > 0) {
            setSelectedStaffId(filtered[0].user.id);
          }
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof ApiClientError ? err.message : "Failed to load shop team members"
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchStaff();

    return () => {
      mounted = false;
    };
  }, [isOpen, shopId, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      setError(`Please select a ${role === "TECHNICIAN" ? "technician" : "parts specialist"}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (role === "TECHNICIAN") {
        await apiClient(`/api/shops/${shopId}/bookings/${bookingId}/transition`, {
          method: "POST",
          body: JSON.stringify({
            to: "ASSIGNED",
            payload: { technicianId: selectedStaffId },
            note: "Assigned by Service Advisor",
          }),
        });
      } else {
        await apiClient(`/api/shops/${shopId}/bookings/${bookingId}/transition`, {
          method: "POST",
          body: JSON.stringify({
            to: "PARTS_PENDING",
            payload: { partsPersonId: selectedStaffId },
            note: "Parts assignment dispatched by Service Advisor",
          }),
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to assign staff member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTech = role === "TECHNICIAN";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                isTech ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40" : "bg-teal-50 text-teal-600 dark:bg-teal-950/40"
              }`}
            >
              {isTech ? <Wrench className="size-5" /> : <Package className="size-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {isTech ? "Assign Workshop Technician" : "Assign Parts Specialist"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isTech
                  ? "Select an active technician from this workshop to lead diagnostic inspection."
                  : "Select an active parts team member to verify and stage required components."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-900">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="staff-select" className="text-xs font-semibold">
              Eligible {isTech ? "Technicians" : "Parts Staff"}
            </Label>

            {isLoading ? (
              <div className="h-10 w-full animate-pulse bg-muted rounded-md" />
            ) : teamMembers.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground bg-muted/40 rounded-md border border-dashed border-border text-center">
                No active {isTech ? "technicians" : "parts personnel"} found in this shop. Add staff in
                Owner settings first.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {teamMembers.map((member) => (
                  <label
                    key={member.user.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedStaffId === member.user.id
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
                        <User className="size-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{member.user.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="staffMember"
                      value={member.user.id}
                      checked={selectedStaffId === member.user.id}
                      onChange={() => setSelectedStaffId(member.user.id)}
                      className="size-4 text-primary"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isLoading || teamMembers.length === 0}
              className="text-xs gap-1.5"
            >
              {isSubmitting ? "Assigning..." : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
