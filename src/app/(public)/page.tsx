"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Clock,
  Star,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  Store,
  Wrench,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { MOCK_PUBLIC_SHOPS } from "@/mocks/customer";
import type { PublicShop } from "@/lib/contracts/public";

const POPULAR_CITIES = ["All", "Karachi", "Lahore", "Islamabad", "Rawalpindi"];

export default function HomePage() {
  const [shops, setShops] = React.useState<PublicShop[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedCity, setSelectedCity] = React.useState("All");
  const [searchQuery, setSearchQuery] = React.useState("");

  const fetchShops = React.useCallback(async (city: string, query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (city !== "All" && city.trim().length > 0) {
        params.set("city", city.trim());
      }
      if (query.trim().length > 0) {
        params.set("q", query.trim());
      }
      const queryString = params.toString() ? `?${params.toString()}` : "";
      const data = await apiClient<PublicShop[]>(`/api/public/shops${queryString}`);
      setShops(Array.isArray(data) ? data : []);
    } catch {
      // Graceful fallback to mock data filtered client-side if live API is temporarily unreachable
      let fallback = [...MOCK_PUBLIC_SHOPS];
      if (city !== "All") {
        fallback = fallback.filter((s) => s.city.toLowerCase() === city.toLowerCase());
      }
      if (query.trim()) {
        const qLower = query.toLowerCase();
        fallback = fallback.filter(
          (s) =>
            s.name.toLowerCase().includes(qLower) ||
            s.city.toLowerCase().includes(qLower) ||
            s.address.toLowerCase().includes(qLower)
        );
      }
      setShops(fallback);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      fetchShops(selectedCity, searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [selectedCity, searchQuery, fetchShops]);

  const handleResetFilters = () => {
    setSelectedCity("All");
    setSearchQuery("");
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Hero section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-muted/50 via-background to-background py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="size-3.5" />
            Verified Certified Workshops
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground">
            Transparent Auto Care & Real-Time Workshop Tracking
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto font-normal">
            Book trusted mechanical repairs, inspect transparent itemized estimates with parts & labour, and track every stage live.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3 max-w-xl mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workshop name, service or address..."
                className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            {searchQuery && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                className="shrink-0"
              >
                <RotateCcw className="size-4" />
              </Button>
            )}
          </div>

          {/* City Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
            <span className="text-xs font-medium text-muted-foreground mr-1">City:</span>
            {POPULAR_CITIES.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCity === city
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Workshop Directory */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Partner Workshops {selectedCity !== "All" && `in ${selectedCity}`}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Explore workshop bays with real-time slot availability.
            </p>
          </div>
          {!isLoading && (
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {shops.length} {shops.length === 1 ? "workshop" : "workshops"} found
            </span>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-5 w-12" />
                </div>
                <Skeleton className="h-4 w-1/2" />
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="h-10 w-full mt-4" />
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-destructive">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchShops(selectedCity, searchQuery)}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && shops.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-4 max-w-md mx-auto">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Store className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No workshops found</h3>
              <p className="text-xs text-muted-foreground">
                No verified garages matched your current filter or search criteria.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </div>
        )}

        {/* Shop Cards Grid */}
        {!isLoading && !error && shops.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map((shop) => (
              <Card
                key={shop.id}
                className="flex flex-col justify-between hover:shadow-md transition-shadow border-border"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg sm:text-xl font-bold leading-tight">
                      {shop.name}
                    </CardTitle>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                      <Star className="size-3 fill-amber-500 text-amber-500" />
                      {shop.rating?.toFixed(1) ?? "4.8"}
                    </span>
                  </div>
                  <CardDescription className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{shop.address}, {shop.city}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 text-sm flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" />
                    <span>{shop.workStart} — {shop.workEnd}</span>
                    <span className="text-border">•</span>
                    <span>{shop.slotCapacity} bays</span>
                    <span className="text-border">•</span>
                    <span>{shop.slotMinutes}m slots</span>
                  </div>

                  {shop.services && shop.services.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Wrench className="size-3" /> Services
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {shop.services.slice(0, 3).map((srv) => (
                          <span
                            key={srv.id}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground"
                          >
                            <span>{srv.name}</span>
                            {srv.basePrice != null && (
                              <span className="text-muted-foreground font-mono">
                                PKR {srv.basePrice.toLocaleString()}
                              </span>
                            )}
                          </span>
                        ))}
                        {shop.services.length > 3 && (
                          <span className="inline-flex rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                            +{shop.services.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="border-t border-border/50 pt-4 flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{shop.phone}</span>
                  </div>
                  <Link
                    href={`/book?shopId=${shop.id}`}
                    className={buttonVariants({ size: "sm", className: "gap-1 shrink-0" })}
                  >
                    Book Service
                    <ArrowRight className="size-3.5" />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
