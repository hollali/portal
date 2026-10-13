CREATE TABLE "research_event_news" (
    "event_id" TEXT NOT NULL,
    "news_id" INTEGER NOT NULL,
    CONSTRAINT "research_event_news_pkey" PRIMARY KEY ("event_id", "news_id")
);

CREATE INDEX "research_event_news_news_id_idx" ON "research_event_news"("news_id");

ALTER TABLE "research_event_news"
    ADD CONSTRAINT "research_event_news_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "research_events"("event_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "research_event_news"
    ADD CONSTRAINT "research_event_news_news_id_fkey"
    FOREIGN KEY ("news_id") REFERENCES "news"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
