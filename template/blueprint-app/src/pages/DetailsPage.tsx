import { BpCard, BpStack, BpTable, BpText, type BpTableColumn } from "@netapp/blueprint";

type Row = {
  id: string;
  name: string;
  status: string;
};

const columns: BpTableColumn<Row>[] = [
  {
    id: "name",
    header: "Name",
    render: (row) => row.name,
  },
  {
    id: "status",
    header: "Status",
    render: (row) => row.status,
  },
];

const rows: Row[] = [
  { id: "1", name: "Cluster A", status: "Healthy" },
  { id: "2", name: "Cluster B", status: "Needs review" },
];

export function DetailsPage() {
  return (
    <BpStack space="400">
      <BpText type="page-title">Details</BpText>
      <BpCard>
        <BpTable data={rows} columns={columns} getRowId={(row) => row.id} />
      </BpCard>
    </BpStack>
  );
}
