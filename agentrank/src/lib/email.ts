/**
 * Purchase confirmation email via Resend. No-op when RESEND_API_KEY is unset,
 * so email is an optional integration rather than a hard dependency.
 */

import { formatUsd, getCatalogItem } from "@/lib/pricing";

export async function sendPurchaseConfirmation(params: {
  to: string;
  sku: string;
  listingName: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const item = getCatalogItem(params.sku);
  if (!item) return;
  const from = process.env.EMAIL_FROM ?? "UPrank <onboarding@resend.dev>";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: `Your UPrank placement is live — ${item.label}`,
        text: [
          `Thanks for your purchase!`,
          ``,
          `Listing: ${params.listingName}`,
          `Placement: ${item.label}`,
          `Amount: ${formatUsd(item.amountCents)} (fixed price — no auction)`,
          ``,
          item.kind === "permanent"
            ? `Your permanent rank is now live and stays yours until you cancel.`
            : `Your placement is live now and will expire automatically at the end of its duration.`,
          site ? `` : undefined,
          site ? `See it on the board: ${site}` : undefined,
          ``,
          `— UPrank`,
        ]
          .filter((line) => line !== undefined)
          .join("\n"),
      }),
    });
    if (!res.ok) {
      console.error("Resend error", res.status, await res.text());
    }
  } catch (err) {
    // Email must never break payment processing.
    console.error("Failed to send confirmation email", err);
  }
}
