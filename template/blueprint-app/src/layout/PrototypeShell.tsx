import { BpAppShell, BpContentRegion, BpHeader, BpMainNav, BpMainRegion, BpServiceNavItem } from "@netapp/blueprint";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { label: "Home", path: "/home" },
  { label: "Details", path: "/details" },
];

export function PrototypeShell() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <BpAppShell>
      <BpHeader.Prototype title="Your prototype" />
      <BpMainRegion>
        <BpMainNav>
          {navItems.map((item) => (
            <BpServiceNavItem
              key={item.path}
              label={item.label}
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </BpMainNav>
        <BpContentRegion>
          <Outlet />
        </BpContentRegion>
      </BpMainRegion>
    </BpAppShell>
  );
}
