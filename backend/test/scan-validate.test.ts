import { describe, expect, it } from 'vitest';
import { isValidDate, normalizeTime, parseScanResult } from '../functions/scans/validate';

describe('isValidDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidDate('2025-01-07')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2025-02-29')).toBe(false);
    expect(isValidDate('2025-1-7')).toBe(false);
    expect(isValidDate(20250107)).toBe(false);
  });
});

describe('normalizeTime', () => {
  it('pads and bounds times', () => {
    expect(normalizeTime('9:30')).toBe('09:30');
    expect(normalizeTime('16:15')).toBe('16:15');
    expect(normalizeTime('24:00')).toBeNull();
    expect(normalizeTime('4:15pm')).toBeNull();
    expect(normalizeTime(null)).toBeNull();
  });
});

describe('parseScanResult', () => {
  it('normalizes events and repairs inconsistencies', () => {
    const r = parseScanResult(JSON.stringify({
      readable: true,
      confidence: 1.4,
      events: [
        { title: '  Dentist   Appt ', date: '2025-01-07', start: '13:00', end: null, allDay: false, note: '', confidence: 0.9 },
        { title: 'No school', date: '2025-01-08', start: '08:00', end: '09:00', allDay: true, note: null, confidence: 0.8 },
        { title: 'Soccer', date: '2025-01-06', start: null, end: '19:00', allDay: false, note: null, confidence: 0.7 },
        { title: 'Golf', date: '2024-04-24', start: '17:30', end: '17:00', allDay: false, note: null, confidence: 0.6 },
      ],
    }));
    expect(r.confidence).toBe(1);
    expect(r.events[0]).toEqual({ title: 'Dentist Appt', date: '2025-01-07', start: '13:00', end: null, allDay: false, note: null, confidence: 0.9 });
    expect(r.events[1]).toMatchObject({ allDay: true, start: null, end: null });
    expect(r.events[2]).toMatchObject({ allDay: true, start: null, end: null });
    expect(r.events[3]).toMatchObject({ start: '17:30', end: null });
  });

  it('drops invalid events and duplicates', () => {
    const r = parseScanResult(JSON.stringify({
      readable: true,
      confidence: 0.8,
      events: [
        { title: '', date: '2025-01-07', start: '13:00' },
        { title: 'Bad date', date: '2025-13-01', start: '13:00' },
        { title: 'Swim', date: '2025-01-07', start: '16:00', confidence: 0.9 },
        { title: 'swim', date: '2025-01-07', start: '16:00', confidence: 0.9 },
      ],
    }));
    expect(r.events.map((e) => e.title)).toEqual(['Swim']);
  });

  it('extracts JSON wrapped in prose and defaults readable to true', () => {
    const r = parseScanResult('Here you go:\n{"confidence":0.5,"events":[]}\nThanks');
    expect(r).toEqual({ readable: true, confidence: 0.5, events: [] });
  });

  it('honours readable=false', () => {
    expect(parseScanResult('{"readable":false,"confidence":0.1,"events":[]}').readable).toBe(false);
  });

  it('throws when there is no JSON', () => {
    expect(() => parseScanResult('I cannot help with that.')).toThrow();
  });
});
