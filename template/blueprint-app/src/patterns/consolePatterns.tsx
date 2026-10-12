import type { CSSProperties, ReactNode } from "react";
import {
  BpCard,
  BpCardProperty,
  BpInline,
  BpNotification,
  type BpCardPropertyProps,
  type BpNotificationProps,
} from "@netapp/blueprint";

/**
 * Proto Hub Console composition helpers.
 * These encode Figma component-config rules that Blueprint CSS alone does not
 * apply for full-bleed Console list pages. Use them instead of reinventing layout.
 */

/** Cell style for KPI properties inside a padding={false} metric band (Figma Card / property). */
export const metricPropertyStyle: CSSProperties = {
  flex: "1 0 0",
  minWidth: 149,
  padding: "var(--space-300) var(--space-500)",
  boxSizing: "border-box",
};

type MetricItem = {
  property: string;
  value: ReactNode;
  unit?: string;
  icon?: BpCardPropertyProps["icon"];
  statusTone?: BpCardPropertyProps["statusTone"];
  /** Extra props forwarded to BpCardProperty (e.g. FormatCapacityParts spread). */
  propertyProps?: Partial<BpCardPropertyProps>;
};

/**
 * Full-width KPI / property band for table+dashboard pages.
 * Uses BpCard padding={false} + equal BpCardProperty columns with Figma cell padding.
 */
export function MetricPropertyBand({ items }: { items: MetricItem[] }) {
  return (
    <BpCard padding={false} style={{ width: "100%" }}>
      <BpInline space="0" wrap style={{ width: "100%" }}>
        {items.map((item, index) => (
          <BpCardProperty
            key={`${item.property}-${index}`}
            icon={item.icon}
            value={item.value}
            unit={item.unit}
            property={item.property}
            statusTone={item.statusTone}
            hasRightSeparator={index < items.length - 1}
            style={metricPropertyStyle}
            {...item.propertyProps}
          />
        ))}
      </BpInline>
    </BpCard>
  );
}

/**
 * Page-level alert that spans the content column.
 * (Standalone BpNotification defaults to max-width 792px for component demos.)
 */
export function PageAlert(props: BpNotificationProps) {
  const { style, ...rest } = props;
  return <BpNotification {...rest} style={{ width: "100%", maxWidth: "none", ...style }} />;
}
