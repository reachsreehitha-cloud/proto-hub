import { useState } from "react";
import {
  BpAppShell,
  BpContentRegion,
  BpHeader,
  BpInline,
  BpMainNav,
  BpMainRegion,
  BpPageShell,
  BpServiceNav,
  BpSkipLink,
  BpStack,
  type BpMainNavCategory,
} from "@netapp/blueprint";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { id: "home", label: "Home", path: "/home" },
  { id: "details", label: "Details", path: "/details" },
];

const navCategories: BpMainNavCategory[] = [
  {
    id: "storage",
    label: "Storage",
    icon: "ic_object_storage",
    services: [
      { id: "home", label: "Home", description: "Prototype home screen." },
      { id: "details", label: "Details", description: "Detail and table example." },
    ],
  },
];

/**
 * App-shell-first Console starter (matches Blueprint README + early Proto Hub one-shots).
 * Agents should keep this structure; only change nav items / productName / routes.
 */
export function PrototypeShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeControlId, setActiveControlId] = useState<string | null>(null);

  const selectedItemId = location.pathname.startsWith("/details") ? "details" : "home";

  return (
    <BpPageShell>
      <BpSkipLink />
      <BpAppShell
        header={
          <BpHeader.Prototype
            productName="Console"
            activeControlId={activeControlId}
            onActiveControlChange={setActiveControlId}
            mainNavPanel={
              <BpMainNav
                open={activeControlId === "main-nav"}
                onOpenChange={(open) => setActiveControlId(open ? "main-nav" : null)}
                categories={navCategories}
                activeCategoryId="storage"
                selectedServiceId={selectedItemId}
                dismissOnSelect
                onServiceSelect={(serviceId) => {
                  const item = navItems.find((navItem) => navItem.id === serviceId);
                  if (item) {
                    navigate(item.path);
                    setActiveControlId(null);
                  }
                }}
              />
            }
          />
        }
        content={
          <BpMainRegion>
            {/*
              Full-height service rail: BpInline defaults to align-items:center and
              content height. Proto Hub index.css stretches this row to the viewport;
              keep alignItems stretch here so agents do not regress it.
            */}
            <BpInline
              wrap={false}
              space="0"
              style={{
                alignItems: "stretch",
                width: "100%",
                flex: 1,
                minHeight: "calc(100vh - var(--bp-shell-header-h, 0px))",
              }}
            >
              <BpServiceNav
                serviceLabel="Storage"
                categoryLabel="Screens"
                items={navItems.map(({ id, label }) => ({ id, label }))}
                selectedItemId={selectedItemId}
                onItemSelect={(id) => {
                  const item = navItems.find((navItem) => navItem.id === id);
                  if (item) navigate(item.path);
                }}
              />
              <BpStack grow space="0" style={{ minWidth: 0, minHeight: "100%" }}>
                <BpContentRegion id="bp-main-content" tabIndex={-1} width="full" center={false} padded>
                  <Outlet />
                </BpContentRegion>
              </BpStack>
            </BpInline>
          </BpMainRegion>
        }
      />
    </BpPageShell>
  );
}
