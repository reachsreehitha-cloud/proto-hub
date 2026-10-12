"use client";

import type { ReactNode } from "react";
import { FeedbackReportFab } from "./FeedbackReport";

/** Shared chrome on every Proto Hub screen (gallery, drafts, help, review). */
export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FeedbackReportFab />
    </>
  );
}
