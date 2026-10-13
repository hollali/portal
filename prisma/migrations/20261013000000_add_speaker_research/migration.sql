CREATE TABLE "research_datasets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "accessed_date" TEXT NOT NULL,
    "cutoff_date" TEXT NOT NULL,
    "subject" JSONB NOT NULL,
    "coverage" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "research_datasets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "research_sources" (
    "record_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "download_url" TEXT,
    "publication_date" TEXT,
    "sitting_date" TEXT,
    "accessed_date" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "term_or_session" TEXT,
    "persons" JSONB NOT NULL,
    "locator" TEXT,
    "summary" TEXT NOT NULL,
    "relevance" TEXT NOT NULL,
    "verification_status" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "research_sources_pkey" PRIMARY KEY ("record_id")
);

CREATE TABLE "research_events" (
    "event_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "start_date" TEXT,
    "end_date" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attribution" TEXT NOT NULL,
    "evidence_status" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "research_events_pkey" PRIMARY KEY ("event_id")
);

CREATE TABLE "research_event_sources" (
    "event_id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    CONSTRAINT "research_event_sources_pkey" PRIMARY KEY ("event_id", "record_id")
);

CREATE UNIQUE INDEX "research_sources_dataset_id_original_url_key"
    ON "research_sources"("dataset_id", "original_url");
CREATE INDEX "research_sources_dataset_id_idx" ON "research_sources"("dataset_id");
CREATE INDEX "research_sources_verification_status_idx" ON "research_sources"("verification_status");
CREATE INDEX "research_events_dataset_id_start_date_idx" ON "research_events"("dataset_id", "start_date");
CREATE INDEX "research_event_sources_record_id_idx" ON "research_event_sources"("record_id");

ALTER TABLE "research_sources"
    ADD CONSTRAINT "research_sources_dataset_id_fkey"
    FOREIGN KEY ("dataset_id") REFERENCES "research_datasets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_events"
    ADD CONSTRAINT "research_events_dataset_id_fkey"
    FOREIGN KEY ("dataset_id") REFERENCES "research_datasets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_event_sources"
    ADD CONSTRAINT "research_event_sources_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "research_events"("event_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_event_sources"
    ADD CONSTRAINT "research_event_sources_record_id_fkey"
    FOREIGN KEY ("record_id") REFERENCES "research_sources"("record_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
