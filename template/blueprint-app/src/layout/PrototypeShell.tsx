import {
  BpAppShell,
  BpContentRegion,
  BpHeader,
  BpInline,
  BpMainRegion,
  BpServiceNav,
  BpStack,
} from "@netapp/blueprint";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { id: "home", label: "Home", path: "/home" },
  { id: "details", label: "Details", path: "/details" },
];

export function PrototypeShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedItemId = location.pathname.startsWith("/details") ? "details" : "home";

  return (
    <BpAppShell>
      <BpHeader.Prototype productName="Your prototype" />
      <BpMainRegion>
        <BpInline wrap={false} space="0" style={{ alignItems: "stretch", width: "100%" }}>
          <BpServiceNav
            serviceLabel="Prototype"
            categoryLabel="Screens"
            items={navItems.map(({ id, label }) => ({ id, label }))}
            selectedItemId={selectedItemId}
            onItemSelect={(id) => {
              const item = navItems.find((navItem) => navItem.id === id);
              if (item) navigate(item.path);
            }}
          />
          <BpStack grow space="0" style={{ minWidth: 0 }}>
            <BpContentRegion width="wide">
              <Outlet />
            </BpContentRegion>
          </BpStack>
        </BpInline>
      </BpMainRegion>
    </BpAppShell>
  );
}
