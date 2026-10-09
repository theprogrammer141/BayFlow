import * as React from "react";
import Link from "next/link";
import { Search, MapPin, Clock, Star, ShieldCheck, ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { MOCK_PUBLIC_SHOPS } from "@/mocks/customer";

export default function HomePage() {
  return (
    <div className="space-y-12 pb-16">
      {/* Hero section */}
      <section className="relative overflow-hidden border-b border-border bg-linear-to-b from-muted/50 via-background to-background py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="size-3.5" />
            Verified Certified Workshops
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-foreground max-w-3xl mx-auto">
            Transparent Auto Care & Real-Time Workshop Tracking
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto font-normal">
            Book trusted mechanical repairs, approve digital estimates with itemized parts & labour, and monitor every stage from inspection to road test.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search workshops or city..."
                className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <Button size="lg" className="w-full sm:w-auto">
              Find Services
            </Button>
          </div>
        </div>
      </section>

      {/* Workshop Directory */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Featured Repair Shops</h2>
            <p className="text-sm text-muted-foreground">Browse certified garages with live slot availability.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_PUBLIC_SHOPS.map((shop) => (
            <Card key={shop.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-xl font-bold">{shop.name}</CardTitle>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Star className="size-3 fill-amber-500 text-amber-500" />
                    4.9
                  </span>
                </div>
                <CardDescription className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                  {shop.address}, {shop.city}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span>Hours: {shop.workStart} — {shop.workEnd}</span>
                  <span className="text-border">•</span>
                  <span>Cap: {shop.slotCapacity} bays</span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Popular Services</p>
                  <div className="flex flex-wrap gap-1.5">
                    {shop.services?.slice(0, 3).map((srv) => (
                      <span key={srv.id} className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {srv.name}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="border-t border-border/50 pt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Next slot: Today</span>
                <Link
                  href="/customer"
                  className={buttonVariants({ size: "sm" })}
                >
                  Book Service
                  <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
