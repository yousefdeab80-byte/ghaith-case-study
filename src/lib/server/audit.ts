import "server-only";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";

export async function logAudit(
  user: Pick<User, "id" | "name"> | null, entity: string, entityId: string | null, action: string,
  changes?: Record<string, { from: unknown; to: unknown }>,
) {
  await db.insert(schema.auditLog).values({ userId: user?.id, userName: user?.name, entity, entityId, action, changes });
}
