import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup, BACKUP_MAGIC, BACKUP_SCHEMA_VERSION } from './backup.js';

describe('buildBackup', () => {
  it('includes magic + schema version + trips', () => {
    const out = buildBackup({ trips: [{ id: 'a' }], settings: {} });
    expect(out.magic).toBe(BACKUP_MAGIC);
    expect(out.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(out.trips).toHaveLength(1);
    expect(out.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('strips sensitive fields from settings', () => {
    const settings = {
      apiKey: 'sk-or-leak',
      pinHash: 'h', pinSalt: 's', pinAlgo: 'x', pinEnabled: true,
      pinFails: 3, pinLockUntil: 12345,
      biometricEnabled: true, biometricCredId: 'cred',
      theme: 'dark',
      expenseLimits: { pranzo: 30 },
    };
    const out = buildBackup({ trips: [], settings });
    expect(out.settings.apiKey).toBeUndefined();
    expect(out.settings.pinHash).toBeUndefined();
    expect(out.settings.biometricCredId).toBeUndefined();
    expect(out.settings.theme).toBe('dark');
    expect(out.settings.expenseLimits.pranzo).toBe(30);
  });
});

describe('parseBackup', () => {
  it('parses a freshly built backup', () => {
    const built = buildBackup({ trips: [{ id: 'a', expenses: [] }], settings: { theme: 'auto' } });
    const text = JSON.stringify(built);
    const parsed = parseBackup(text);
    expect(parsed.trips).toHaveLength(1);
    expect(parsed.settings.theme).toBe('auto');
  });

  it('rejects non-JSON input', () => {
    expect(() => parseBackup('not json {')).toThrow();
  });

  it('rejects wrong magic', () => {
    expect(() => parseBackup(JSON.stringify({ magic: 'something-else', schemaVersion: 1, trips: [] }))).toThrow(/non riconosciuto/i);
  });

  it('rejects unsupported schema version', () => {
    expect(() =>
      parseBackup(JSON.stringify({ magic: BACKUP_MAGIC, schemaVersion: 999, trips: [] }))
    ).toThrow(/Versione/);
  });

  it('rejects missing trips array', () => {
    expect(() =>
      parseBackup(JSON.stringify({ magic: BACKUP_MAGIC, schemaVersion: 1 }))
    ).toThrow(/trips/);
  });
});
