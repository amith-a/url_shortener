import type { ColumnDefinitions, MigrationBuilder } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('user', {
    id: { type: 'text', primaryKey: true },
    name: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
    emailVerified: { type: 'boolean', notNull: true, default: false },
    image: { type: 'text' },
    createdAt: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updatedAt: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('session', {
    id: { type: 'text', primaryKey: true },
    expiresAt: { type: 'timestamptz', notNull: true },
    token: { type: 'text', notNull: true, unique: true },
    createdAt: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updatedAt: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    ipAddress: { type: 'text' },
    userAgent: { type: 'text' },
    userId: {
      type: 'text',
      notNull: true,
      references: '"user"',
      onDelete: 'CASCADE',
    },
  });

  pgm.createTable('account', {
    id: { type: 'text', primaryKey: true },
    accountId: { type: 'text', notNull: true },
    providerId: { type: 'text', notNull: true },
    userId: {
      type: 'text',
      notNull: true,
      references: '"user"',
      onDelete: 'CASCADE',
    },
    accessToken: { type: 'text' },
    refreshToken: { type: 'text' },
    idToken: { type: 'text' },
    accessTokenExpiresAt: { type: 'timestamptz' },
    refreshTokenExpiresAt: { type: 'timestamptz' },
    scope: { type: 'text' },
    password: { type: 'text' },
    createdAt: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updatedAt: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createTable('verification', {
    id: { type: 'text', primaryKey: true },
    identifier: { type: 'text', notNull: true },
    value: { type: 'text', notNull: true },
    expiresAt: { type: 'timestamptz', notNull: true },
    createdAt: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updatedAt: { type: 'timestamptz', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('verification');
  pgm.dropTable('account');
  pgm.dropTable('session');
  pgm.dropTable('user');
}
