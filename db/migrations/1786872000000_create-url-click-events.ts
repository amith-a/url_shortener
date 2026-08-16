import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('url_click_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    url_id: {
      type: 'uuid',
      notNull: true,
      references: 'urls',
      onDelete: 'CASCADE',
    },
    clicked_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

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
