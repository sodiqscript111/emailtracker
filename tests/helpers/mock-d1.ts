import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createMockD1Database(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  // Load and apply initial migration
  const migrationPath = path.resolve(__dirname, '../../apps/worker/migrations/0001_initial_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  sqlite.exec(migrationSql);
  sqlite.exec('PRAGMA foreign_keys = ON;');

  return {
    prepare(query: string): D1PreparedStatement {
      let boundParams: unknown[] = [];

      const preparedStatement = {
        bind(...params: unknown[]) {
          boundParams = params;
          return preparedStatement as unknown as D1PreparedStatement;
        },

        async first<T = unknown>(colName?: string): Promise<T | null> {
          const stmt = sqlite.prepare(query);
          const result = stmt.get(...boundParams) as Record<string, unknown> | undefined;
          if (!result) return null;
          if (colName && typeof colName === 'string') {
            return (result[colName] as T) ?? null;
          }
          return result as T;
        },

        async all<T = unknown>(): Promise<D1Result<T>> {
          const stmt = sqlite.prepare(query);
          const results = stmt.all(...boundParams) as T[];
          return {
            results,
            success: true,
            meta: {
              duration: 0,
              rows_read: results.length,
              rows_written: 0,
              changes: 0,
              last_row_id: 0,
              size_after: 0,
              served_by: 'mock-d1',
            },
          };
        },

        async run(): Promise<D1Response> {
          const stmt = sqlite.prepare(query);
          const result = stmt.run(...boundParams);
          return {
            success: true,
            meta: {
              duration: 0,
              rows_read: 0,
              rows_written: Number(result.changes),
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
              size_after: 0,
              served_by: 'mock-d1',
            },
          };
        },

        async raw<T = unknown>(): Promise<T[]> {
          const stmt = sqlite.prepare(query);
          return stmt.all(...boundParams) as unknown as T[];
        },
      } as unknown as D1PreparedStatement;

      return preparedStatement;
    },

    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push(await stmt.all<T>());
      }
      return results;
    },

    async exec(query: string): Promise<D1ExecResult> {
      sqlite.exec(query);
      return {
        count: 1,
        duration: 0,
      };
    },

    dump(): Promise<ArrayBuffer> {
      throw new Error('dump not implemented in mock');
    },
  } as unknown as D1Database;
}
