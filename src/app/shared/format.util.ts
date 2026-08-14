/**
 * Einheitliche Ausgabe von Beträgen und Daten.
 *
 * Zentral, weil sonst jede Komponente ihre eigene Formatierung mitbringt —
 * und damit auch jede ihre eigenen Rundungsartefakte.
 */

/** Beträge unterhalb eines halben Cents gelten als null. */
const CENT_SCHWELLE = 0.005;

/**
 * Glättet Fließkomma-Reste und die negative Null.
 *
 * Ohne das erscheint ein Saldo von -5.55e-17 als "-0,00": rechnerisch
 * richtig, aber irreführend. Dasselbe gilt für -0, das in JavaScript ein
 * eigener Wert ist und von toLocaleString mit Vorzeichen ausgegeben wird.
 */
export function normalisiereBetrag(betrag: number): number {
  if (!Number.isFinite(betrag)) return 0;
  return Math.abs(betrag) < CENT_SCHWELLE ? 0 : betrag;
}

/** Betrag mit zwei Nachkommastellen, ohne Währungszeichen. */
export function euro(betrag: number): string {
  return normalisiereBetrag(betrag).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** ISO-Datum als "07.08.2026". */
export function datumKurz(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE');
}

/** ISO-Datum als "Fr., 07.08.2026". */
export function datumMitTag(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** ISO-Datum als "Freitag, 7. August 2026". */
export function datumLang(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function datumZeitKurz(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
