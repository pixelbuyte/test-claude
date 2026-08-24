import type { Metadata } from "next";

import { SubmitForm } from "@/components/submit-form";

export const metadata: Metadata = {
  title: "List for free",
  description:
    "Add your AI agent, automation tool, or social profile to the AgentRank open section — completely free.",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-14 pb-8 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        List for free
      </h1>
      <p className="mt-3 text-muted">
        Add your AI agent, automation tool, X handle, LinkedIn, YouTube,
        Discord — anything. Free listings live in the open section and rank by
        real outbound clicks. You can buy a timed placement or a permanent rank
        for the same listing later, without ever creating a duplicate.
      </p>
      <div className="mt-8">
        <SubmitForm />
      </div>
    </div>
  );
}
