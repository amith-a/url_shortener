import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE url_click_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      url_id UUID NOT NULL,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_url_click_events_url
        FOREIGN KEY (url_id)
        REFERENCES urls(id)
        ON DELETE CASCADE
    );
  `);

  pgm.createIndex(
    'url_click_events',
    ['url_id', { name: 'clicked_at', sort: 'DESC' }],
    {
      name: 'idx_url_click_events_url_id_clicked_at',
    }
  );
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('url_click_events', 'idx_url_click_events_url_id_clicked_at');
  pgm.dropTable('url_click_events');
}
