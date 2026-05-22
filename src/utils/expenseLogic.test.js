import { describe, it, expect } from 'vitest';
import {
  similarMerchant,
  findContentDuplicate,
  looksLikeSameTransaction,
  mergeQueueItems,
  detectQueueGroups,
  requiredDocsList,
  expenseDocCheck,
} from './expenseLogic.js';

describe('similarMerchant', () => {
  it('matches identical names', () => {
    expect(similarMerchant('Bar Pippo', 'Bar Pippo')).toBe(true);
  });

  it('strips SRL/SPA/SNC legal suffixes', () => {
    expect(similarMerchant('Bar Pippo SRL', 'Bar Pippo SPA')).toBe(true);
    expect(similarMerchant('Bar Pippo S.R.L.', 'Bar Pippo')).toBe(true);
    expect(similarMerchant('Bar Pippo s.n.c.', 'Bar Pippo SNC')).toBe(true);
  });

  it('matches when first word matches and is long enough', () => {
    expect(similarMerchant('Trattoria Roma centro', 'Trattoria Roma succursale')).toBe(true);
  });

  it('does not match unrelated merchants', () => {
    expect(similarMerchant('Bar Pippo', 'Trattoria Roma')).toBe(false);
  });

  it('handles empty input gracefully', () => {
    expect(similarMerchant('', 'something')).toBe(false);
    expect(similarMerchant(null, undefined)).toBe(false);
  });
});

describe('findContentDuplicate', () => {
  const expenses = [
    { id: 'a', data: '2026-01-15', importo: 25.5, esercente: 'Bar Centro' },
    { id: 'b', data: '2026-01-16', importo: 12.0, esercente: 'Caffè Roma' },
  ];

  it('finds a duplicate with matching date, amount, merchant', () => {
    const candidate = { data: '2026-01-15', importo: 25.5, esercente: 'Bar Centro SRL' };
    const dup = findContentDuplicate(candidate, expenses);
    expect(dup?.id).toBe('a');
  });

  it('returns null when amount differs', () => {
    const candidate = { data: '2026-01-15', importo: 30, esercente: 'Bar Centro' };
    expect(findContentDuplicate(candidate, expenses)).toBeNull();
  });

  it('returns null when date differs', () => {
    const candidate = { data: '2026-02-01', importo: 25.5, esercente: 'Bar Centro' };
    expect(findContentDuplicate(candidate, expenses)).toBeNull();
  });

  it('ignores zero-importo candidates', () => {
    const candidate = { data: '2026-01-15', importo: 0, esercente: 'Bar Centro' };
    expect(findContentDuplicate(candidate, expenses)).toBeNull();
  });
});

describe('looksLikeSameTransaction', () => {
  it('matches scontrino + POS with same merchant/date/category', () => {
    const a = { data: '2026-01-15', categoria: 'pranzo', esercente: 'Trattoria Romana', importo: 22, documents: { scontrino: true } };
    const b = { data: '2026-01-15', categoria: 'pranzo', esercente: 'Trattoria Romana', importo: 22, documents: { pos: true } };
    expect(looksLikeSameTransaction(a, b)).toBe(true);
  });

  it('does not match different dates', () => {
    const a = { data: '2026-01-15', categoria: 'pranzo', esercente: 'X', importo: 20, documents: { scontrino: true } };
    const b = { data: '2026-01-16', categoria: 'pranzo', esercente: 'X', importo: 20, documents: { pos: true } };
    expect(looksLikeSameTransaction(a, b)).toBe(false);
  });
});

describe('mergeQueueItems', () => {
  it('union of documents and best (longest) descrizione/esercente', () => {
    const items = [
      { id: '1', data: { esercente: 'Bar', importo: 10, descrizione: 'Caffè', documents: { scontrino: true } } },
      { id: '2', data: { esercente: 'Bar Pippo', importo: 10.5, descrizione: 'Caffè + cornetto', documents: { pos: true } } },
    ];
    const merged = mergeQueueItems(items);
    expect(merged.data.esercente).toBe('Bar Pippo');
    expect(merged.data.importo).toBe(10.5);
    expect(merged.data.descrizione).toBe('Caffè + cornetto');
    expect(merged.data.documents.scontrino).toBe(true);
    expect(merged.data.documents.pos).toBe(true);
    expect(merged.data.merged).toBe(true);
  });
});

describe('detectQueueGroups', () => {
  it('groups together items that look like the same transaction', () => {
    const items = [
      { id: '1', status: 'done', data: { data: '2026-01-15', categoria: 'pranzo', esercente: 'Trat Roma', importo: 22, documents: { scontrino: true } } },
      { id: '2', status: 'done', data: { data: '2026-01-15', categoria: 'pranzo', esercente: 'Trat Roma', importo: 22, documents: { pos: true } } },
      { id: '3', status: 'done', data: { data: '2026-01-16', categoria: 'cena', esercente: 'X', importo: 50, documents: { scontrino: true } } },
    ];
    const groups = detectQueueGroups(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('ignores non-done items', () => {
    const items = [
      { id: '1', status: 'processing', data: {} },
      { id: '2', status: 'done', data: { data: '2026-01-15', categoria: 'p', esercente: 'X', importo: 1, documents: { scontrino: true } } },
    ];
    expect(detectQueueGroups(items)).toHaveLength(0);
  });
});

describe('requiredDocsList / expenseDocCheck', () => {
  it('flattens alternatives into a deduped list', () => {
    const settings = { requiredDocs: { alternatives: [['scontrino'], ['fattura', 'pos']] } };
    const list = requiredDocsList(settings);
    expect(list).toContain('scontrino');
    expect(list).toContain('fattura');
    expect(list).toContain('pos');
  });

  it('returns ok=true when at least one alternative is satisfied', () => {
    const settings = { requiredDocs: { alternatives: [['scontrino'], ['fattura', 'pos']] } };
    const expense = { documents: { scontrino: true } };
    expect(expenseDocCheck(expense, settings).ok).toBe(true);
  });

  it('reports the alternative with the fewest missing docs', () => {
    const settings = { requiredDocs: { alternatives: [['scontrino', 'fattura'], ['pos']] } };
    const expense = { documents: {} };
    const check = expenseDocCheck(expense, settings);
    expect(check.ok).toBe(false);
    expect(check.missing).toEqual(['pos']);
  });

  it('ok=true when no rules configured', () => {
    expect(expenseDocCheck({ documents: {} }, { requiredDocs: { alternatives: [] } }).ok).toBe(true);
  });
});
