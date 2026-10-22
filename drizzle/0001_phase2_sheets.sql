CREATE TABLE "sheet_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"from_email" text NOT NULL,
	"to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"method" text NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sent_by" uuid,
	"sent_by_name" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nomination_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"convoy" text,
	"governorate" text,
	"planned_date" date,
	"target_count" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"sent_at" timestamp with time zone,
	"sent_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "nominations_case_project_uq";--> statement-breakpoint
ALTER TABLE "nominations" ADD COLUMN "sheet_id" uuid;--> statement-breakpoint
ALTER TABLE "sheet_emails" ADD CONSTRAINT "sheet_emails_sheet_id_nomination_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."nomination_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nomination_sheets" ADD CONSTRAINT "nomination_sheets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sheet_emails_sheet_idx" ON "sheet_emails" USING btree ("sheet_id");--> statement-breakpoint
CREATE INDEX "sheets_project_idx" ON "nomination_sheets" USING btree ("project_id","status");--> statement-breakpoint
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_sheet_id_nomination_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."nomination_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "nominations_pool_uq" ON "nominations" USING btree ("case_id","project_id") WHERE "nominations"."sheet_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "nominations_sheet_uq" ON "nominations" USING btree ("case_id","sheet_id") WHERE "nominations"."sheet_id" is not null;--> statement-breakpoint
CREATE INDEX "nominations_sheet_idx" ON "nominations" USING btree ("sheet_id");