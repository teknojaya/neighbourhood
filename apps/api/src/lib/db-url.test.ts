import { describe, expect, it } from 'vitest';
import { databasePoolMax, isLoopbackDatabaseUrl } from './db-url.js';

describe('isLoopbackDatabaseUrl', () => {
  it('accepts local TCP databases', () => {
    expect(isLoopbackDatabaseUrl('postgresql://u:p@127.0.0.1:55432/neighbourhood?schema=public')).toBe(true);
    expect(isLoopbackDatabaseUrl('postgres://u:p@localhost/neighbourhood_test')).toBe(true);
    expect(isLoopbackDatabaseUrl('postgresql://u:p@[::1]:5432/db')).toBe(true);
  });

  it('rejects a Cloud SQL socket URL even though its hostname is localhost', () => {
    expect(isLoopbackDatabaseUrl('postgresql://u:p@localhost/neighbourhood?host=/cloudsql/proj:asia-southeast2:db')).toBe(false);
  });

  it('rejects remote, malformed and missing URLs', () => {
    expect(isLoopbackDatabaseUrl('postgresql://u:p@10.0.0.5:5432/db')).toBe(false);
    expect(isLoopbackDatabaseUrl('postgresql://u:p@db.example.com/db')).toBe(false);
    expect(isLoopbackDatabaseUrl('mysql://u:p@localhost/db')).toBe(false);
    expect(isLoopbackDatabaseUrl('not a url')).toBe(false);
    expect(isLoopbackDatabaseUrl(undefined)).toBe(false);
  });
});

describe('databasePoolMax', () => {
  it('defaults to 10 and accepts a bounded integer', () => {
    expect(databasePoolMax({})).toBe(10);
    expect(databasePoolMax({ DATABASE_POOL_MAX: ' 4 ' })).toBe(4);
  });

  it('rejects invalid values instead of silently using them', () => {
    for (const value of ['0', '101', '2.5', 'many']) expect(() => databasePoolMax({ DATABASE_POOL_MAX: value })).toThrow(/DATABASE_POOL_MAX/);
  });
});
