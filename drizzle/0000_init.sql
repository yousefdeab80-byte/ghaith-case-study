CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"user_name" text,
	"entity" text NOT NULL,
	"entity_id" text,
	"action" text NOT NULL,
	"changes" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid,
	"name" text NOT NULL,
	"nid" text,
	"phone" text,
	"project_name" text NOT NULL,
	"project_id" uuid,
	"convoy" text,
	"governorate" text,
	"village" text,
	"benefit_date" date,
	"quantity" integer DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_no" serial NOT NULL,
	"form_type" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'study' NOT NULL,
	"exclusion_reason" text,
	"head_name" text NOT NULL,
	"head_nid" text,
	"wife_name" text,
	"wife_nid" text,
	"phone" text,
	"phone2" text,
	"governorate" text,
	"markaz" text,
	"village" text,
	"address" text,
	"marital_status" text,
	"income_type" text,
	"health_status" text,
	"family_size" integer,
	"children_count" integer,
	"total_income" numeric(12, 2),
	"total_expenses" numeric(12, 2),
	"roof_type" text,
	"explorer_name" text,
	"guide_name" text,
	"explored_at" date,
	"guide_approved" boolean DEFAULT false NOT NULL,
	"explorer_approved" boolean DEFAULT false NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"import_batch_id" uuid,
	"completeness" integer DEFAULT 0 NOT NULL,
	"priority_score" integer DEFAULT 0 NOT NULL,
	"priority_level" text DEFAULT 'low' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"merged" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nominations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" text DEFAULT 'nominated' NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sector" text DEFAULT 'مبادرة موسمية' NOT NULL,
	"rules_key" text DEFAULT 'seasonal' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"min_days_between_benefits" integer,
	"required_docs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feedback_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sample_ratio" numeric(4, 2) DEFAULT '0.30' NOT NULL,
	"settlement_deadline_days" integer DEFAULT 4 NOT NULL,
	"impact_after_days" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'coordinator' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "benefits_nid_idx" ON "benefits" USING btree ("nid");--> statement-breakpoint
CREATE INDEX "benefits_case_idx" ON "benefits" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cases_head_nid_uq" ON "cases" USING btree ("head_nid") WHERE "cases"."head_nid" is not null;--> statement-breakpoint
CREATE INDEX "cases_wife_nid_idx" ON "cases" USING btree ("wife_nid");--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cases_geo_idx" ON "cases" USING btree ("governorate","markaz","village");--> statement-breakpoint
CREATE INDEX "cases_file_no_idx" ON "cases" USING btree ("file_no");--> statement-breakpoint
CREATE UNIQUE INDEX "nominations_case_project_uq" ON "nominations" USING btree ("case_id","project_id");