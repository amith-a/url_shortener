import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('urls', 'short_code', {
    type: 'varchar(50)',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('urls', 'short_code', {
    type: 'varchar(8)',
  });
}
