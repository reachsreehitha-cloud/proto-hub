import { BpButton, BpCard, BpStack, BpText } from "@netapp/blueprint";
import { useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <BpStack space="400">
      <BpText type="page-title">Your prototype</BpText>
      <BpText type="body-text">
        This starter uses @netapp/blueprint@legacy. Prompt Cursor or Claude to build your flow using Blueprint
        components and the layout guidance in node_modules/@netapp/blueprint/dist/agent/docs/ai-layout-guidance.md.
      </BpText>
      <BpCard>
        <BpStack space="300">
          <BpText type="section-title">Starter screen</BpText>
          <BpText type="body-text">
            Replace this page with your concept. Keep hash routes so Proto Hub can deep-link to screens.
          </BpText>
          <BpButton onClick={() => navigate("/details")}>Go to details</BpButton>
        </BpStack>
      </BpCard>
    </BpStack>
  );
}
