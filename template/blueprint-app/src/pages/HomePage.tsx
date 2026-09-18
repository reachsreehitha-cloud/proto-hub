import { BpButton, BpCard, BpStack, BpText } from "@netapp/blueprint";
import { useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <BpStack gap="lg">
      <BpText variant="heading1">Your prototype</BpText>
      <BpText variant="body">
        This starter uses @netapp/blueprint@legacy. Prompt Cursor to build your flow using Blueprint components,
        tokens, and the layout guidance in node_modules/@netapp/blueprint/dist/agent/docs/ai-layout-guidance.md.
      </BpText>
      <BpCard>
        <BpStack gap="md">
          <BpText variant="heading3">Starter screen</BpText>
          <BpText variant="body">Replace this page with your concept. Keep hash routes so Proto Hub can deep-link to screens.</BpText>
          <BpButton onClick={() => navigate("/details")}>Go to details</BpButton>
        </BpStack>
      </BpCard>
    </BpStack>
  );
}
