import { describe, it, expect } from 'vitest';
import { datumKurz, euro, normalisiereBetrag } from './format.util';

describe('normalisiereBetrag', () => {
  it('glättet Fließkomma-Reste zu null', () => {
    // Solche Werte entstehen beim Filtern von Zeiträumen in der
    // Kontenübersicht und wurden vorher als "-0,00" angezeigt.
    expect(normalisiereBetrag(-5.551115123125783e-17)).toBe(0);
    expect(normalisiereBetrag(5.551115123125783e-17)).toBe(0);
  });

  it('macht aus der negativen Null eine echte Null', () => {
    expect(Object.is(normalisiereBetrag(-0), -0)).toBe(false);
    expect(normalisiereBetrag(-0)).toBe(0);
  });

  it('behält Beträge ab einem halben Cent', () => {
    expect(normalisiereBetrag(-0.01)).toBe(-0.01);
    expect(normalisiereBetrag(0.006)).toBe(0.006);
  });

  it('verwirft Beträge unter einem halben Cent', () => {
    expect(normalisiereBetrag(0.004)).toBe(0);
  });

  it('fängt ungültige Werte ab', () => {
    expect(normalisiereBetrag(Number.NaN)).toBe(0);
    expect(normalisiereBetrag(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('euro', () => {
  it('gibt zwei Nachkommastellen aus', () => {
    expect(euro(5)).toBe('5,00');
    expect(euro(1234.5)).toBe('1.234,50');
  });

  it('zeigt niemals eine negative Null', () => {
    expect(euro(-0)).toBe('0,00');
    expect(euro(-1e-17)).toBe('0,00');
  });

  it('behält echte negative Beträge', () => {
    expect(euro(-59.9)).toBe('-59,90');
    expect(euro(-0.01)).toBe('-0,01');
  });

  it('rundet kaufmännisch auf Cent', () => {
    expect(euro(1.005)).toBe('1,01');
    expect(euro(1.004)).toBe('1,00');
  });
});

describe('datumKurz', () => {
  it('gibt ein ISO-Datum in deutscher Schreibweise aus', () => {
    expect(datumKurz('2026-08-07')).toBe('7.8.2026');
  });
});
