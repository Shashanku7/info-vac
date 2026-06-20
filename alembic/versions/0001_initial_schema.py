"""Initial schema — all 9 tables

Revision ID: 0001
Revises:
Create Date: 2026-06-20
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgcrypto for gen_random_uuid()
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # 1. programs
    op.execute("""
        CREATE TABLE IF NOT EXISTS programs (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name            VARCHAR(255) NOT NULL,
            status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
            llm_used        VARCHAR(50)  NOT NULL DEFAULT 'claude',
            schema_version  VARCHAR(10)  NOT NULL DEFAULT 'v1',
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
            completed_at    TIMESTAMPTZ,
            error_message   TEXT
        )
    """)

    # 2. sources
    op.execute("""
        CREATE TABLE IF NOT EXISTS sources (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
            url             TEXT NOT NULL,
            source_type     VARCHAR(50) NOT NULL,
            title           TEXT,
            raw_content     TEXT,
            content_hash    VARCHAR(64),
            fetch_method    VARCHAR(20) NOT NULL DEFAULT 'firecrawl',
            fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            fetch_status    VARCHAR(20) NOT NULL DEFAULT 'success',
            UNIQUE(program_id, url)
        )
    """)

    # 3. extracted_fields
    op.execute("""
        CREATE TABLE IF NOT EXISTS extracted_fields (
            id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            program_id                  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
            category                    VARCHAR(50) NOT NULL,
            field_name                  VARCHAR(100) NOT NULL,
            field_value                 JSONB,
            is_null                     BOOLEAN NOT NULL DEFAULT FALSE,
            claimed_snippet             TEXT,
            gate_passed                 BOOLEAN,
            match_score                 NUMERIC(4,3),
            corroboration_score         NUMERIC(3,2),
            authority_score             NUMERIC(3,2),
            recency_score               NUMERIC(3,2),
            confidence                  NUMERIC(3,2),
            source_id                   UUID REFERENCES sources(id),
            access_date                 TIMESTAMPTZ,
            contradiction_flag          BOOLEAN NOT NULL DEFAULT FALSE,
            contradiction_note          TEXT,
            self_consistency_runs       JSONB,
            self_consistency_agreement  NUMERIC(3,2),
            created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(program_id, field_name)
        )
    """)

    # 4. narratives
    op.execute("""
        CREATE TABLE IF NOT EXISTS narratives (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
            narrative_text  TEXT NOT NULL,
            word_count      INT NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # 5. comparisons
    op.execute("""
        CREATE TABLE IF NOT EXISTS comparisons (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            program_a_id    UUID NOT NULL REFERENCES programs(id),
            program_b_id    UUID NOT NULL REFERENCES programs(id),
            analysis_json   JSONB NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # 6. conversations
    op.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            program_id          UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
            role                VARCHAR(20) NOT NULL,
            message             TEXT NOT NULL,
            grounded_field_ids  UUID[],
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # 7. pipeline_events (replaces Redis pub/sub)
    op.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_events (
            id          BIGSERIAL PRIMARY KEY,
            program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
            stage       VARCHAR(50) NOT NULL,
            progress    NUMERIC(3,2),
            detail      TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Trigger function + trigger for LISTEN/NOTIFY
    op.execute("""
        CREATE OR REPLACE FUNCTION notify_pipeline_event() RETURNS trigger AS $$
        BEGIN
            PERFORM pg_notify(
                'pipeline_events_' || NEW.program_id::text,
                row_to_json(NEW)::text
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    op.execute("""
        CREATE TRIGGER trg_pipeline_event
        AFTER INSERT ON pipeline_events
        FOR EACH ROW EXECUTE FUNCTION notify_pipeline_event()
    """)

    # 8. eval_ground_truth (Day 8 eval harness)
    op.execute("""
        CREATE TABLE IF NOT EXISTS eval_ground_truth (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
            field_name      VARCHAR(100) NOT NULL,
            expected_value  JSONB,
            verified_by     VARCHAR(100) NOT NULL,
            verified_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(program_id, field_name)
        )
    """)

    # 9. redteam_tests (Day 9 red-team log)
    op.execute("""
        CREATE TABLE IF NOT EXISTS redteam_tests (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            test_name       VARCHAR(100) NOT NULL,
            program_id      UUID REFERENCES programs(id),
            payload         TEXT,
            expected_result VARCHAR(50) NOT NULL,
            actual_result   VARCHAR(50),
            passed          BOOLEAN,
            run_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # Indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_fields_program ON extracted_fields(program_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sources_program ON sources(program_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fields_contradiction ON extracted_fields(contradiction_flag) WHERE contradiction_flag = TRUE")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fields_gate_failed ON extracted_fields(gate_passed) WHERE gate_passed = FALSE")
    op.execute("CREATE INDEX IF NOT EXISTS idx_events_program ON pipeline_events(program_id, created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS redteam_tests CASCADE")
    op.execute("DROP TABLE IF EXISTS eval_ground_truth CASCADE")
    op.execute("DROP TABLE IF EXISTS pipeline_events CASCADE")
    op.execute("DROP TABLE IF EXISTS conversations CASCADE")
    op.execute("DROP TABLE IF EXISTS comparisons CASCADE")
    op.execute("DROP TABLE IF EXISTS narratives CASCADE")
    op.execute("DROP TABLE IF EXISTS extracted_fields CASCADE")
    op.execute("DROP TABLE IF EXISTS sources CASCADE")
    op.execute("DROP TABLE IF EXISTS programs CASCADE")
    op.execute("DROP FUNCTION IF EXISTS notify_pipeline_event CASCADE")
