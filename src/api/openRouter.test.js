import { describe, it, expect } from 'vitest';
import { parseReceiptResponse } from './openRouter.js';

describe('parseReceiptResponse', () => {
  it('parses a clean JSON response', () => {
    const text = JSON.stringify({
      esercente: 'Bar Centro',
      importo: 12.5,
      data: '2026-01-15',
      ora: '08:30',
      categoria: 'colazione',
      descrizione: 'Cappuccino e cornetto',
      valuta: 'EUR',
      documenti: { scontrino: true, pos: false, fattura: false, estratto: false },
    });
    const out = parseReceiptResponse(text);
    expect(out.esercente).toBe('Bar Centro');
    expect(out.importo).toBe(12.5);
    expect(out.data).toBe('2026-01-15');
    expect(out.ora).toBe('08:30');
    expect(out.categoria).toBe('colazione');
    expect(out.detectedDocs.scontrino).toBe(true);
  });

  it('strips markdown code fences', () => {
    const text = '```json\n' + JSON.stringify({ esercente: 'X', importo: 1, data: '2026-01-01', categoria: 'altro' }) + '\n```';
    const out = parseReceiptResponse(text);
    expect(out.esercente).toBe('X');
  });

  it('coerces stringy importo with comma and currency symbol', () => {
    const text = JSON.stringify({ esercente: 'X', importo: '12,50 €', data: '2026-01-01', categoria: 'altro' });
    const out = parseReceiptResponse(text);
    expect(out.importo).toBe(12.5);
  });

  it('defaults today when data is invalid', () => {
    const text = JSON.stringify({ esercente: 'X', importo: 1, data: 'not-a-date', categoria: 'altro' });
    const out = parseReceiptResponse(text);
    expect(out.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns null ora when missing or unparseable', () => {
    const text = JSON.stringify({ esercente: 'X', importo: 1, data: '2026-01-01', categoria: 'altro' });
    expect(parseReceiptResponse(text).ora).toBeNull();
  });

  it('clamps invalid categoria to altro', () => {
    const text = JSON.stringify({ esercente: 'X', importo: 1, data: '2026-01-01', categoria: 'space-travel' });
    expect(parseReceiptResponse(text).categoria).toBe('altro');
  });

  it('throws on non-JSON content', () => {
    expect(() => parseReceiptResponse('just some text with no braces')).toThrow();
  });

  it('accepts legacy ricevuta_pos alias', () => {
    const text = JSON.stringify({
      esercente: 'X', importo: 1, data: '2026-01-01', categoria: 'altro',
      documenti: { ricevuta_pos: true },
    });
    expect(parseReceiptResponse(text).detectedDocs.pos).toBe(true);
  });
});
