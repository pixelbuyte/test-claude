import type { Metadata } from "next";

import { AdminDashboard, AdminLogin } from "@/components/admin-client";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import {
  demoMode,
  getAllListings,
  getPayments,
  getTotalRevenueCents,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <Shell>
        <p className="text-muted">
          Set the <code>ADMIN_PASSWORD</code> environment variable to enable
          the admin dashboard.
        </p>
      </Shell>
    );
  }

  if (!(await isAdmin())) {
    return (
      <Shell>
        <AdminLogin />
      </Shell>
    );
  }

  const [listings, payments, revenueCents] = await Promise.all([
    getAllListings(),
    getPayments(),
    getTotalRevenueCents(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-14 pb-8 sm:px-6">
      <h1 className="mb-2 font-display text-3xl font-semibold tracking-tight">
        Admin
      </h1>
      {demoMode() && (
        <p className="mb-6 text-sm text-muted">
          Running on demo data — configure Supabase to manage real listings.
        </p>
      )}
      <AdminDashboard
        listings={listings}
        payments={payments}
        revenueCents={revenueCents}
      />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-20 pb-8 sm:px-6">
      <h1 className="mb-8 text-center font-display text-3xl font-semibold tracking-tight">
        Admin
      </h1>
      {children}
    </div>
  );
}
