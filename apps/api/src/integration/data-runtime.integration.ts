import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Pool } from 'pg';

interface PostgresError {
  readonly code: string;
  readonly constraint?: string;
}

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
  );
}

describe('data runtime', () => {
  it('applies the migration history and enforces foundation constraints', async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl === undefined) {
      throw new Error('DATABASE_URL is required for the integration test.');
    }

    const pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 2_000,
      max: 1,
    });

    try {
      const migrations = await pool.query<{
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>('SELECT finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at');

      assert.equal(migrations.rowCount, 3);
      assert.ok(migrations.rows[0]?.finished_at instanceof Date);
      assert.equal(migrations.rows[0]?.rolled_back_at, null);
      assert.ok(migrations.rows[1]?.finished_at instanceof Date);
      assert.equal(migrations.rows[1]?.rolled_back_at, null);
      assert.ok(migrations.rows[2]?.finished_at instanceof Date);
      assert.equal(migrations.rows[2]?.rolled_back_at, null);

      const constraints = await pool.query<{ conname: string }>(
        `SELECT conname
         FROM pg_constraint
         WHERE conname = ANY($1::text[])
         ORDER BY conname`,
        [
          [
            'auth_session_expiration_valid',
            'enrollment_current_week_valid',
            'enrollment_version_positive',
            'idempotency_record_completion_consistent',
            'idempotency_record_expiration_valid',
            'idempotency_record_response_status_valid',
            'mentor_assignment_period_valid',
            'mentor_assignment_version_positive',
            'oleada_capacity_positive',
            'oleada_date_range_valid',
            'oleada_version_positive',
            'outbox_event_attempt_count_nonnegative',
            'schedule_reservation_no_overlap',
            'schedule_reservation_valid_interval',
            'session_participant_attendance_time_valid',
            'session_participant_confirmation_time_valid',
            'session_participant_version_positive',
            'session_reminder_attempt_count_nonnegative',
            'session_reminder_lock_valid',
            'session_reschedule_request_decision_valid',
            'session_reschedule_request_version_positive',
            'session_valid_confirmation_cutoff',
            'session_valid_interval',
            'session_valid_phase_period',
            'session_version_positive',
            'user_version_positive',
          ],
        ],
      );

      assert.equal(constraints.rowCount, 26);

      await pool.query('BEGIN');
      await pool.query(
        `INSERT INTO organization (id, name, slug, updated_at)
         VALUES ('00000000-0000-4000-8000-000000000001', 'Synthetic Org', 'synthetic-org', NOW())`,
      );

      await assert.rejects(
        () =>
          pool.query(
            `INSERT INTO oleada (
               id,
               organization_id,
               name,
               sector,
               start_date,
               end_date,
               capacity,
               updated_at
             )
             VALUES (
               '00000000-0000-4000-8000-000000000002',
               '00000000-0000-4000-8000-000000000001',
               'Synthetic Cohort',
               'Technology',
               DATE '2026-08-01',
               DATE '2026-08-31',
               0,
               NOW()
             )`,
          ),
        (error: unknown) =>
          isPostgresError(error) &&
          error.code === '23514' &&
          error.constraint === 'oleada_capacity_positive',
      );
    } finally {
      await pool.query('ROLLBACK').catch(() => undefined);
      await pool.end();
    }
  });
});
