import { BpCard, BpStack, BpTable, BpText } from "@netapp/blueprint";

const columns = [
  { key: "name", header: "Name" },
  { key: "status", header: "Status" },
];

const rows = [
  { id: "1", name: "Cluster A", status: "Healthy" },
  { id: "2", name: "Cluster B", status: "Needs review" },
];

export function DetailsPage() {
  return (
    <BpStack gap="lg">
      <BpText variant="heading1">Details</BpText>
      <BpCard>
        <BpTable columns={columns} rows={rows} />
      </BpCard>
    </BpStack>
  );
}
