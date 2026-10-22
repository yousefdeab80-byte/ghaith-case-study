import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";
import type { PermissionKey } from "@/lib/constants";

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const uid = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, uid));
  return user && user.active ? user : null;
}

export function can(user: User | null, perm: PermissionKey): boolean {
  return !!user && (user.role === "manager" || !!user.permissions[perm]);
}

/** للصفحات والأكشنز: يرجّع المستخدم أو يحول لصفحة الدخول / يرمي خطأ صلاحية. */
export async function requireUser(perm?: PermissionKey): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (perm && !can(user, perm)) throw new Error("ليس لديك صلاحية لهذا الإجراء");
  return user;
}
