import { BpStack, BpText } from "@netapp/blueprint";

/**
 * Default landing page after Create.
 * Service nav (left) is the only navigation. Do not add starter cards or "go to X" buttons.
 * Agents should replace this page with the real first screen for the prototype.
 */
export function HomePage() {
  return (
    <BpStack space="300">
      <BpText type="page-title">Your prototype</BpText>
      <BpText type="body-text">Describe the screen you want in Cursor. Keep PrototypeShell and Blueprint.</BpText>
    </BpStack>
  );
}
