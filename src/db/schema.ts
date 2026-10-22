import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb, numeric, date, serial, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** مستخدمو النظام. الصلاحيات مخزنة كخريطة مفتاح → true/false. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("coordinator"),
  permissions: jsonb("permissions").$type<Record<string, boolean>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** إعدادات عامة (القوائم، قائمة التوزيع، الإيميل الرسمي...) كمفتاح → قيمة. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FeedbackQuestion = { id: string; text: string; type: "yesno_pos" | "yesno_neg" | "scale"; weight: number };

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  /** تكافل | تمكين | مبادرة موسمية */
  sector: text("sector").notNull().default("مبادرة موسمية"),
  /** مفتاح قواعد الاستحقاق في src/lib/eligibility.ts */
  rulesKey: text("rules_key").notNull().default("seasonal"),
  active: boolean("active").notNull().default(true),
  /** أقل مدة (بالأيام) بين استفادتين من نفس المشروع */
  minDaysBetweenBenefits: integer("min_days_between_benefits"),
  requiredDocs: jsonb("required_docs").$type<string[]>().notNull().default([]),
  feedbackQuestions: jsonb("feedback_questions").$type<FeedbackQuestion[]>().notNull().default([]),
  /** نسبة عينة مكالمات الفيد باك (0..1) */
  sampleRatio: numeric("sample_ratio", { precision: 4, scale: 2 }).notNull().default("0.30"),
  settlementDeadlineDays: integer("settlement_deadline_days").notNull().default(4),
  impactAfterDays: integer("impact_after_days"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FamilyMember = {
  name?: string; relation?: string; gender?: string; age?: string; nid?: string;
  eduStage?: string; job?: string; income?: string; health?: string;
};

/** ملف الحالة (الأسرة). الحقول اللي بنفلتر عليها أعمدة، والباقي في details. */
export const cases = pgTable("cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileNo: serial("file_no").notNull(),
  formType: text("form_type").notNull().default("general"),
  /** study | eligible | served | excluded */
  status: text("status").notNull().default("study"),
  exclusionReason: text("exclusion_reason"),

  headName: text("head_name").notNull(),
  headNid: text("head_nid"),
  wifeName: text("wife_name"),
  wifeNid: text("wife_nid"),
  phone: text("phone"),
  phone2: text("phone2"),

  governorate: text("governorate"),
  markaz: text("markaz"),
  village: text("village"),
  address: text("address"),

  maritalStatus: text("marital_status"),
  incomeType: text("income_type"),
  healthStatus: text("health_status"),
  familySize: integer("family_size"),
  childrenCount: integer("children_count"),
  totalIncome: numeric("total_income", { precision: 12, scale: 2 }),
  totalExpenses: numeric("total_expenses", { precision: 12, scale: 2 }),
  roofType: text("roof_type"),

  explorerName: text("explorer_name"),
  guideName: text("guide_name"),
  exploredAt: date("explored_at"),
  guideApproved: boolean("guide_approved").notNull().default(false),
  explorerApproved: boolean("explorer_approved").notNull().default(false),

  members: jsonb("members").$type<FamilyMember[]>().notNull().default([]),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  recommendations: jsonb("recommendations").$type<string[]>().notNull().default([]),

  source: text("source").notNull().default("manual"),
  importBatchId: uuid("import_batch_id"),
  completeness: integer("completeness").notNull().default(0),
  priorityScore: integer("priority_score").notNull().default(0),
  priorityLevel: text("priority_level").notNull().default("low"),
  notes: text("notes"),

  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("cases_head_nid_uq").on(t.headNid).where(sql`${t.headNid} is not null`),
  index("cases_wife_nid_idx").on(t.wifeNid),
  index("cases_status_idx").on(t.status),
  index("cases_geo_idx").on(t.governorate, t.markaz, t.village),
  index("cases_file_no_idx").on(t.fileNo),
]);

/** ترشيح حالة لمشروع. */
export const nominations = pgTable("nominations", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  /** nominated | sent | executed | dropped */
  status: text("status").notNull().default("nominated"),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("nominations_case_project_uq").on(t.caseId, t.projectId)]);

/** سجل الاستفادات (المساعدات المنفذة)، القديمة والجديدة. */
export const benefits = pgTable("benefits", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").references(() => cases.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  nid: text("nid"),
  phone: text("phone"),
  projectName: text("project_name").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  convoy: text("convoy"),
  governorate: text("governorate"),
  village: text("village"),
  benefitDate: date("benefit_date"),
  quantity: integer("quantity").notNull().default(1),
  source: text("source").notNull().default("manual"),
  importBatchId: uuid("import_batch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("benefits_nid_idx").on(t.nid), index("benefits_case_idx").on(t.caseId)]);

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  fileName: text("file_name").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  created: integer("created").notNull().default(0),
  merged: integer("merged").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  issues: jsonb("issues").$type<{ row: number; message: string }[]>().notNull().default([]),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** سجل التعديلات: مين عدل إيه وامتى. */
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id"),
  userName: text("user_name"),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  action: text("action").notNull(),
  changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_entity_idx").on(t.entity, t.entityId)]);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
export type Benefit = typeof benefits.$inferSelect;
