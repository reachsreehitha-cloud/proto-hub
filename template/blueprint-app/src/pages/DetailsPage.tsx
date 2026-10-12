import { useMemo, useState } from "react";
import {
  BpButton,
  BpColorBadge,
  BpDropdown,
  BpInline,
  BpSearch,
  BpSimpleFilters,
  BpStack,
  BpTable,
  BpTableUpperActions,
  BpText,
  type BpTableColumn,
} from "@netapp/blueprint";
import { MetricPropertyBand, PageAlert } from "../patterns/consolePatterns";

type Row = {
  id: string;
  name: string;
  status: "healthy" | "attention";
  type: string;
};

const columns: BpTableColumn<Row>[] = [
  { id: "name", header: "Name", sortable: true, render: (row) => row.name },
  {
    id: "status",
    header: "State",
    sortable: true,
    render: (row) => (
      <BpColorBadge
        color={row.status === "healthy" ? "green" : "orange"}
        label={row.status === "healthy" ? "Healthy" : "Needs attention"}
      />
    ),
  },
  { id: "type", header: "Type", sortable: true, render: (row) => row.type },
];

const rows: Row[] = [
  { id: "1", name: "Cluster A", status: "healthy", type: "AFF" },
  { id: "2", name: "Cluster B", status: "attention", type: "FAS" },
  { id: "3", name: "Cluster C", status: "healthy", type: "CVO" },
];

/**
 * Optional second route: table+dashboard composition reference (PageAlert → MetricPropertyBand → filters → table).
 * Home has no buttons that navigate here. Users use the left service nav only.
 */
export function DetailsPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "healthy" | "attention">("all");
  const [bannerVisible, setBannerVisible] = useState(true);

  const attention = useMemo(() => rows.filter((row) => row.status === "attention"), []);
  const visible = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (query.trim() && !row.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    });
  }, [query, statusFilter]);

  return (
    <BpStack space="300">
      <BpInline justify="between" align="start" wrap>
        <BpStack space="100">
          <BpText type="page-title">Details</BpText>
          <BpText type="body-text">Replace with your screen.</BpText>
        </BpStack>
        <BpInline space="200" wrap>
          <BpButton>Primary action</BpButton>
          <BpButton appearance="outline">Secondary</BpButton>
        </BpInline>
      </BpInline>

      {bannerVisible && attention.length > 0 ? (
        <PageAlert
          status="warning"
          title={`${attention.length} systems need attention`}
          description={
            <>
              Review{" "}
              {attention.map((row, index) => (
                <span key={row.id}>
                  {index > 0 ? (index === attention.length - 1 ? " and " : ", ") : null}
                  <strong>{row.name}</strong>
                </span>
              ))}
              .
            </>
          }
          actionLabel="Review systems"
          onAction={() => setStatusFilter("attention")}
          onDismiss={() => setBannerVisible(false)}
        />
      ) : null}

      <MetricPropertyBand
        items={[
          { property: "Systems", value: String(rows.length), icon: "fleet" },
          {
            property: "Healthy",
            value: String(rows.length - attention.length),
            statusTone: "success",
          },
          {
            property: "Needs attention",
            value: String(attention.length),
            statusTone: attention.length > 0 ? "warning" : "success",
          },
        ]}
      />

      <BpSimpleFilters
        onReset={statusFilter !== "all" ? () => setStatusFilter("all") : undefined}
      >
        <BpDropdown
          variant="underline"
          label="State"
          value={statusFilter}
          showClearButton={false}
          style={{ width: "auto", minWidth: 160, maxWidth: 280 }}
          options={[
            { value: "all", label: "All" },
            { value: "healthy", label: "Healthy" },
            { value: "attention", label: "Needs attention" },
          ]}
          onValueChange={(value) =>
            setStatusFilter((value as "all" | "healthy" | "attention" | undefined) ?? "all")
          }
        />
      </BpSimpleFilters>

      <BpTable<Row>
        data={visible}
        columns={columns}
        getRowId={(row) => row.id}
        name="Systems"
        totalCount={rows.length}
        visibleCount={visible.length}
        details={`${visible.length} of ${rows.length} systems`}
        emptyState={rows.length === 0 ? "no-data" : "no-results"}
        toolbar={
          <BpTableUpperActions>
            <BpSearch
              expandable={false}
              placeholder="Search systems"
              aria-label="Search systems"
              value={query}
              onValueChange={setQuery}
              onClear={() => setQuery("")}
            />
          </BpTableUpperActions>
        }
      />
    </BpStack>
  );
}
