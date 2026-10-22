"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { SESSION_COOKIE, signSession } from "@/lib/session-token";
import { logAudit } from "@/lib/server/audit";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return "اسم المستخدم أو كلمة المرور غير صحيحة";
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12,
  });
  await logAudit(user, "user", user.id, "login");
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
