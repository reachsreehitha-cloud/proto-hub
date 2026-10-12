/** Shared copy for Help + the Publish confirmation popup. */

export const UX_HOST = "ux.netapp.com";

export const GITHUB_ACCESS_GUIDE =
  "https://netapp.atlassian.net/wiki/spaces/UX/pages/699076324/GitHub+access+and+package+authentication+for+designers";

/** People who can help with GitHub / Proto Hub access */
export const PUBLISH_HELP_CONTACTS = "Dylan, Sree, or Mihir";

/**
 * Where issue reports are emailed (override with PROTO_HUB_HELP_EMAIL).
 * Also written to data/issue-reports.json.
 */
export const HELP_REPORT_EMAIL =
  process.env.PROTO_HUB_HELP_EMAIL || "sb29895@netapp.com";

/**
 * Optional external form (Google / Microsoft Forms).
 * Set NEXT_PUBLIC_HELP_FORM_URL after you create the form. Help shows it as “Report”.
 */
export const HELP_FORM_URL =
  process.env.NEXT_PUBLIC_HELP_FORM_URL?.trim() || "";

export type PublishPathStep = {
  id: string;
  label: string;
  short: string;
};

/** End-to-end path: create → live on ux.netapp.com → share the link. */
export const PUBLISH_PATH_STEPS: PublishPathStep[] = [
  { id: "create", label: "Create", short: "Start" },
  { id: "cursor", label: "Cursor", short: "Build" },
  { id: "preview", label: "Preview", short: "Check" },
  { id: "publish", label: "Publish", short: "Live" },
  { id: "share", label: "Share", short: "Link" },
];
