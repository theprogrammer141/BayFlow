"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Car,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Store,
  Wrench,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  CreateBookingRequestSchema,
  type CreateBookingRequest,
} from "@/lib/contracts/booking";
import type { PublicShop, PublicSlot } from "@/lib/contracts/public";
import { MOCK_PUBLIC_SHOPS } from "@/mocks/customer";

interface CreatedBookingData {
  id: string;
  status: string;
  shop: { name: string; city: string; address: string };
  vehicle: { make: string; model: string; regNo: string };
}

function BookingWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialShopId = searchParams.get("shopId");

  const [step, setStep] = React.useState<number>(1);

  // Data states
  const [shops, setShops] = React.useState<PublicShop[]>([]);
  const [isLoadingShops, setIsLoadingShops] = React.useState(true);
  const [slots, setSlots] = React.useState<PublicSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = React.useState(false);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);

  // Form selection states
  const [selectedShopId, setSelectedShopId] = React.useState<string>(initialShopId || "");
  const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([]);
  const [customerNotes, setCustomerNotes] = React.useState<string>("");
  const [selectedDate, setSelectedDate] = React.useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedSlotId, setSelectedSlotId] = React.useState<string>("");

  // Customer & Vehicle fields
  const [customerName, setCustomerName] = React.useState<string>("");
  const [customerEmail, setCustomerEmail] = React.useState<string>("");
  const [customerPhone, setCustomerPhone] = React.useState<string>("");
  const [customerPassword, setCustomerPassword] = React.useState<string>("");

  const [vehicleRegNo, setVehicleRegNo] = React.useState<string>("");
  const [vehicleMake, setVehicleMake] = React.useState<string>("");
  const [vehicleModel, setVehicleModel] = React.useState<string>("");
  const [vehicleYear, setVehicleYear] = React.useState<number>(new Date().getFullYear());
  const [vehicleColor, setVehicleColor] = React.useState<string>("");
  const [vehicleMileage, setVehicleMileage] = React.useState<string>("");

  // Validation & Submission states
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = React.useState<CreatedBookingData | null>(null);

  // 1. Fetch shops on mount
  React.useEffect(() => {
    async function loadShops() {
      setIsLoadingShops(true);
      try {
        const data = await apiClient<PublicShop[]>("/api/public/shops");
        const list = Array.isArray(data) && data.length > 0 ? data : MOCK_PUBLIC_SHOPS;
        setShops(list);
        if (initialShopId && list.some((s) => s.id === initialShopId)) {
          setSelectedShopId(initialShopId);
          setStep(2);
        }
      } catch {
        setShops(MOCK_PUBLIC_SHOPS);
        if (initialShopId) {
          setSelectedShopId(initialShopId);
          setStep(2);
        }
      } finally {
        setIsLoadingShops(false);
      }
    }
    loadShops();
  }, [initialShopId]);

  // Selected shop helper
  const selectedShop = React.useMemo(
    () => shops.find((s) => s.id === selectedShopId),
    [shops, selectedShopId]
  );

  const [slotsRefreshIndex, setSlotsRefreshIndex] = React.useState(0);

  React.useEffect(() => {
    if (!selectedShopId || !selectedDate) return;
    let isMounted = true;

    async function loadSlots() {
      setIsLoadingSlots(true);
      setSlotsError(null);
      try {
        const data = await apiClient<PublicSlot[]>(
          `/api/public/shops/${selectedShopId}/slots?date=${selectedDate}`
        );
        if (isMounted) {
          setSlots(Array.isArray(data) ? data : []);
          setSelectedSlotId("");
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof ApiClientError ? err.message : "Failed to load slots";
          setSlotsError(message);
          setSlots([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSlots(false);
        }
      }
    }

    void loadSlots();

    return () => {
      isMounted = false;
    };
  }, [selectedShopId, selectedDate, slotsRefreshIndex]);

  const handleRefreshSlots = () => {
    setSlotsRefreshIndex((i) => i + 1);
  };

  // Handle service toggle
  const toggleService = (srvId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(srvId) ? prev.filter((id) => id !== srvId) : [...prev, srvId]
    );
    if (formErrors.serviceIds) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.serviceIds;
        return next;
      });
    }
  };

  // Step validations
  const validateStep = (currentStep: number): boolean => {
    const errors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!selectedShopId) errors.shopId = "Please select a workshop to proceed";
    }

    if (currentStep === 2) {
      if (selectedServiceIds.length === 0) {
        errors.serviceIds = "Please select at least one service";
      }
    }

    if (currentStep === 3) {
      if (!selectedDate) errors.date = "Please select an appointment date";
      if (!selectedSlotId) errors.slotId = "Please select an available time slot";
    }

    if (currentStep === 4) {
      if (!customerName.trim()) errors.name = "Full name is required";
      if (!customerEmail.trim() || !customerEmail.includes("@")) {
        errors.email = "Valid email is required";
      }
      if (!customerPassword || customerPassword.length < 6) {
        errors.password = "Password must be at least 6 characters";
      }
      if (!vehicleRegNo.trim()) errors.regNo = "Vehicle registration number is required";
      if (!vehicleMake.trim()) errors.make = "Vehicle make is required";
      if (!vehicleModel.trim()) errors.model = "Vehicle model is required";
      if (!vehicleYear || vehicleYear < 1900 || vehicleYear > 2100) {
        errors.year = "Valid manufacture year is required";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Booking submission
  const handleConfirmBooking = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const payload: CreateBookingRequest = {
      shopId: selectedShopId,
      slotId: selectedSlotId,
      serviceIds: selectedServiceIds,
      customerNotes: customerNotes.trim() || undefined,
      customer: {
        name: customerName.trim(),
        email: customerEmail.trim(),
        phone: customerPhone.trim() || undefined,
        password: customerPassword,
      },
      vehicle: {
        regNo: vehicleRegNo.trim().toUpperCase(),
        make: vehicleMake.trim(),
        model: vehicleModel.trim(),
        year: Number(vehicleYear),
        color: vehicleColor.trim() || undefined,
        mileage: vehicleMileage ? parseInt(vehicleMileage, 10) : undefined,
      },
    };

    // Client-side Zod validation
    const parsed = CreateBookingRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setSubmitError(issue?.message || "Please check your entered details");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiClient<{
        booking: {
          id: string;
          status: string;
          shop?: { name: string; city: string; address: string };
          vehicle?: { make: string; model: string; regNo: string };
        };
      }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const bk = response.booking;
      setConfirmedBooking({
        id: bk.id,
        status: bk.status,
        shop: {
          name: selectedShop?.name || "Auto Care Workshop",
          city: selectedShop?.city || "",
          address: selectedShop?.address || "",
        },
        vehicle: {
          make: vehicleMake,
          model: vehicleModel,
          regNo: vehicleRegNo.toUpperCase(),
        },
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to create appointment. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION VIEW
  if (confirmedBooking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card className="border-border shadow-lg text-center p-6 sm:p-8 space-y-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              Appointment Confirmed!
            </h1>
            <p className="text-sm text-muted-foreground">
              Your service booking has been created and registered in status{" "}
              <span className="font-semibold text-primary">PENDING</span>.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 text-left text-xs sm:text-sm space-y-3">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Booking ID:</span>
              <span className="font-mono font-semibold text-foreground">#{confirmedBooking.id}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Workshop:</span>
              <span className="font-semibold text-foreground">{confirmedBooking.shop.name}</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Vehicle:</span>
              <span className="font-medium text-foreground">
                {confirmedBooking.vehicle.make} {confirmedBooking.vehicle.model} (
                {confirmedBooking.vehicle.regNo})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location:</span>
              <span className="text-muted-foreground">
                {confirmedBooking.shop.address}, {confirmedBooking.shop.city}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            You are now logged in. The Service Advisor will review and confirm your booking. Track
            updates and review your estimate anytime in the customer portal.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              className="w-full sm:w-auto"
              onClick={() => router.push("/customer")}
            >
              Go to Customer Dashboard
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => router.push("/")}
            >
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // WIZARD MULTI-STEP VIEW
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 space-y-8">
      {/* Step Tracker Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>Step {step} of 5</span>
          <span>
            {step === 1 && "Choose Workshop"}
            {step === 2 && "Select Services"}
            {step === 3 && "Date & Bay Slot"}
            {step === 4 && "Contact & Vehicle"}
            {step === 5 && "Review & Book"}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* STEP 1: SHOP SELECTION */}
      {step === 1 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Store className="size-5 text-primary" />
              Select a Certified Workshop
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Choose the garage you want to service your vehicle.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {formErrors.shopId && (
              <p className="text-xs text-destructive font-medium">{formErrors.shopId}</p>
            )}

            {isLoadingShops ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {shops.map((shop) => {
                  const isSelected = selectedShopId === shop.id;
                  return (
                    <div
                      key={shop.id}
                      onClick={() => setSelectedShopId(shop.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border hover:border-border/80 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm sm:text-base font-bold text-foreground">
                            {shop.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {shop.address}, {shop.city}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          ★ 4.8
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> {shop.workStart} - {shop.workEnd}
                        </span>
                        <span>•</span>
                        <span>{shop.slotCapacity} Bay Capacity</span>
                        <span>•</span>
                        <span>{shop.slotMinutes}m Slots</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between border-t border-border pt-4">
            <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Cancel
            </Link>
            <Button size="sm" onClick={handleNext} disabled={!selectedShopId}>
              Continue to Services
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 2: SERVICE SELECTION & CUSTOMER NOTES */}
      {step === 2 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Wrench className="size-5 text-primary" />
              Select Requested Services
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Pick services offered by {selectedShop?.name || "the workshop"}.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {formErrors.serviceIds && (
              <p className="text-xs text-destructive font-medium">{formErrors.serviceIds}</p>
            )}

            <div className="space-y-2.5">
              {selectedShop?.services && selectedShop.services.length > 0 ? (
                selectedShop.services.map((srv) => {
                  const isChecked = selectedServiceIds.includes(srv.id);
                  return (
                    <div
                      key={srv.id}
                      onClick={() => toggleService(srv.id)}
                      className={`flex cursor-pointer items-start justify-between rounded-xl border p-3.5 transition-all ${
                        isChecked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled by outer div
                          className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{srv.name}</p>
                          {srv.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {srv.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Est. {srv.estMinutes} mins
                          </p>
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs sm:text-sm font-bold text-foreground">
                        {srv.basePrice != null ? `PKR ${srv.basePrice.toLocaleString()}` : "Free Quote"}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">
                  No predefined services listed. You may describe your issues below.
                </p>
              )}
            </div>

            {/* Free-text Customer Notes */}
            <FormField
              id="customerNotes"
              label="Describe Specific Symptoms or Problems (Optional)"
              hint="Mention any sounds, fluid leaks, warning lights, or diagnostic requests"
            >
              <Textarea
                id="customerNotes"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="e.g. Grinding noise when braking at low speed; check AC cooling..."
                rows={3}
                className="text-xs sm:text-sm"
              />
            </FormField>
          </CardContent>

          <CardFooter className="flex justify-between border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
            <Button size="sm" onClick={handleNext} disabled={selectedServiceIds.length === 0}>
              Continue to Schedule
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: DATE & SLOT SELECTION */}
      {step === 3 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              Pick Appointment Date & Time
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Live capacity check ensures your appointment bay is guaranteed.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Date Input */}
            <FormField
              id="bookingDate"
              label="Appointment Date"
              required
              error={formErrors.date}
            >
              <div className="flex gap-2">
                <Input
                  id="bookingDate"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-60"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefreshSlots}
                  title="Refresh slots"
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            </FormField>

            {/* Slots Grid */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1">
                Available Time Bays <span className="text-destructive">*</span>
              </label>

              {formErrors.slotId && (
                <p className="text-xs text-destructive font-medium">{formErrors.slotId}</p>
              )}

              {isLoadingSlots && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {!isLoadingSlots && slotsError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive flex items-center justify-between">
                  <span>{slotsError}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshSlots}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {!isLoadingSlots && !slotsError && slots.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No slots available for this date. Please choose another date.
                </div>
              )}

              {!isLoadingSlots && !slotsError && slots.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {slots.map((slot) => {
                    const timeStr = new Date(slot.startsAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    });
                    const isSelected = selectedSlotId === slot.id;
                    const remainingCapacity = slot.capacity - slot.booked;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`rounded-xl border p-3 text-center transition-all ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                            : "border-border hover:border-primary/50 hover:bg-muted/40 text-foreground"
                        }`}
                      >
                        <div className="text-sm font-semibold">{timeStr}</div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                          }`}
                        >
                          {remainingCapacity} bay{remainingCapacity > 1 ? "s" : ""} open
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
            <Button size="sm" onClick={handleNext} disabled={!selectedSlotId}>
              Continue to Details
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 4: PERSONAL & VEHICLE DETAILS */}
      {step === 4 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <User className="size-5 text-primary" />
              Customer & Vehicle Details
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              We link your appointment directly to your vehicle profile.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Customer Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField id="custName" label="Full Name" required error={formErrors.name}>
                  <Input
                    id="custName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Ahmed Raza"
                  />
                </FormField>

                <FormField id="custPhone" label="Phone Number" hint="For SMS / WhatsApp notifications">
                  <Input
                    id="custPhone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. +92 300 1234567"
                  />
                </FormField>

                <FormField id="custEmail" label="Email Address" required error={formErrors.email}>
                  <Input
                    id="custEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="e.g. ahmed@example.com"
                  />
                </FormField>

                <FormField
                  id="custPass"
                  label="Account Password"
                  required
                  error={formErrors.password}
                  hint="At least 6 chars (reused if account exists)"
                >
                  <Input
                    id="custPass"
                    type="password"
                    value={customerPassword}
                    onChange={(e) => setCustomerPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </FormField>
              </div>
            </div>

            {/* Vehicle Section */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Car className="size-3.5" /> Vehicle Specification
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  id="vehReg"
                  label="Registration Number"
                  required
                  error={formErrors.regNo}
                  hint="e.g. LEA-20-4521 or BKL-19-8902"
                >
                  <Input
                    id="vehReg"
                    value={vehicleRegNo}
                    onChange={(e) => setVehicleRegNo(e.target.value.toUpperCase())}
                    placeholder="e.g. LEA-20-4521"
                  />
                </FormField>

                <FormField id="vehMake" label="Make / Manufacturer" required error={formErrors.make}>
                  <Input
                    id="vehMake"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="e.g. Toyota, Honda, Suzuki"
                  />
                </FormField>

                <FormField id="vehModel" label="Model" required error={formErrors.model}>
                  <Input
                    id="vehModel"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g. Corolla, Civic, Swift"
                  />
                </FormField>

                <FormField id="vehYear" label="Manufacture Year" required error={formErrors.year}>
                  <Input
                    id="vehYear"
                    type="number"
                    min="1990"
                    max="2030"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(parseInt(e.target.value, 10))}
                  />
                </FormField>

                <FormField id="vehColor" label="Color (Optional)">
                  <Input
                    id="vehColor"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                    placeholder="e.g. Super White, Metallic Grey"
                  />
                </FormField>

                <FormField id="vehMileage" label="Current Mileage in KM (Optional)">
                  <Input
                    id="vehMileage"
                    type="number"
                    value={vehicleMileage}
                    onChange={(e) => setVehicleMileage(e.target.value)}
                    placeholder="e.g. 45000"
                  />
                </FormField>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
            <Button size="sm" onClick={handleNext}>
              Review Booking
              <ArrowRight className="size-4 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 5: REVIEW & CONFIRM */}
      {step === 5 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Review & Confirm Appointment
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Please double check all appointment parameters before submitting.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {submitError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs sm:text-sm text-destructive flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Booking Submission Failed</p>
                  <p>{submitError}</p>
                </div>
              </div>
            )}

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Workshop & Schedule Card */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Store className="size-3.5 text-primary" /> Workshop & Bay Time
                </h4>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm text-foreground">{selectedShop?.name}</p>
                  <p className="text-muted-foreground">
                    {selectedShop?.address}, {selectedShop?.city}
                  </p>
                  <p className="text-muted-foreground">{selectedShop?.phone}</p>
                  <div className="pt-2 text-primary font-semibold flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    <span>{selectedDate}</span>
                    <span>•</span>
                    <Clock className="size-3.5" />
                    <span>
                      {slots.find((s) => s.id === selectedSlotId)?.startsAt
                        ? new Date(
                            slots.find((s) => s.id === selectedSlotId)!.startsAt
                          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
                        : "Selected Bay Slot"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vehicle & Customer Card */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Car className="size-3.5 text-primary" /> Vehicle & Customer
                </h4>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm text-foreground">
                    {vehicleMake} {vehicleModel} ({vehicleYear})
                  </p>
                  <p className="font-mono text-muted-foreground font-semibold">
                    REG: {vehicleRegNo}
                  </p>
                  {vehicleColor && <p className="text-muted-foreground">Color: {vehicleColor}</p>}
                  <div className="pt-2 border-t border-border/50">
                    <p className="font-medium text-foreground">{customerName}</p>
                    <p className="text-muted-foreground">{customerEmail}</p>
                    {customerPhone && <p className="text-muted-foreground">{customerPhone}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Services Card */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Wrench className="size-3.5 text-primary" /> Selected Services
              </h4>
              <div className="divide-y divide-border/60 text-xs">
                {selectedShop?.services
                  ?.filter((s) => selectedServiceIds.includes(s.id))
                  .map((srv) => (
                    <div key={srv.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-foreground">{srv.name}</span>
                        <span className="text-muted-foreground ml-2">({srv.estMinutes} mins)</span>
                      </div>
                      <span className="font-mono font-bold text-foreground">
                        {srv.basePrice != null ? `PKR ${srv.basePrice.toLocaleString()}` : "Free Quote"}
                      </span>
                    </div>
                  ))}
              </div>

              {customerNotes && (
                <div className="pt-2 border-t border-border/50 text-xs">
                  <span className="font-semibold text-foreground">Reported Concerns: </span>
                  <span className="text-muted-foreground">{customerNotes}</span>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={handleBack} disabled={isSubmitting}>
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmBooking}
              disabled={isSubmitting}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="size-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Creating Appointment...
                </>
              ) : (
                <>
                  Confirm & Reserve Appointment
                  <CheckCircle2 className="size-4 ml-1" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

export default function BookingWizardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-muted-foreground">
          Loading booking wizard...
        </div>
      }
    >
      <BookingWizardContent />
    </React.Suspense>
  );
}
