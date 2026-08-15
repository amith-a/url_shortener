import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createIndex('urls', ['user_id', { name: 'created_at', sort: 'DESC' }, { name: 'id', sort: 'DESC' }], {
    name: 'idx_urls_user_id_created_at_id',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('urls', 'idx_urls_user_id_created_at_id');
}
