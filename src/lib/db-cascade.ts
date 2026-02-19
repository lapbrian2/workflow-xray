import { deleteWorkflow } from "./db";
import { deleteShareLinksForWorkflow } from "./db-shares";

export async function cascadeDeleteWorkflow(
  id: string
): Promise<{ deleted: boolean; sharesRevoked: number }> {
  // Delete share links first (so they cannot resolve to a deleted workflow)
  const sharesRevoked = await deleteShareLinksForWorkflow(id);
  // Then delete the workflow itself
  const deleted = await deleteWorkflow(id);
  return { deleted, sharesRevoked };
}
