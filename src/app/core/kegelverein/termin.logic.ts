import { Abmeldung, Kegelabend, Kegeltermin, Mitglied, Zeitpunkt } from './kegelverein.models';
import { aktuellerStatus } from './mitglied.util';
import { inject } from '@angular/core';
import { KegelabendService } from './kegelabend.service';

/**
 * Auswertung der Kegeltermine. Reine Funktionen ohne Store-Zugriff.
 */

export interface TerminUebersicht {
  termin: Kegeltermin;
  /** Mitglieder, die sich abgemeldet haben, mit Namen und Grund. */
  abgemeldet: { abmeldung: Abmeldung; name: string }[];
  /** Aktive Mitglieder ohne Abmeldung — die vermutlich kommen. */
  erwartet: Mitglied[];
  vergangen: boolean;
  kegelabend?: Kegelabend;
}

/** Aktueller Zeitpunkt in lokaler Zeit, Format JJJJ-MM-TTTHH:MM. */
export function jetzt(): Zeitpunkt {
  const d = new Date();
  const zweistellig = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}` +
    `T${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}`
  );
}

/**
 * Wer zu einem Termin erwartet wird: aktive Mitglieder ohne Abmeldung.
 *
 * Maßgeblich ist der Status zum Termindatum, nicht der heutige — sonst
 * fehlte in einem vergangenen Termin, wer inzwischen ausgetreten ist.
 * Gastkegler bleiben außen vor: Sie sind nicht verpflichtet zu kommen und
 * müssten sich folglich auch nicht abmelden.
 */
export function erzeugeUebersicht(termin: Kegeltermin, mitglieder: Mitglied[], kegelabende: Kegelabend[] | null): TerminUebersicht {
  const nachId = new Map(mitglieder.map((m) => [m.id, m]));

  const abgemeldet = termin.abmeldungen
    .map((abmeldung) => ({
      abmeldung,
      name: nachId.get(abmeldung.mitgliedId)?.name ?? 'unbekannt',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const abgemeldeteIds = new Set(termin.abmeldungen.map((a) => a.mitgliedId));

  const erwartet = mitglieder
    .filter((m) => !abgemeldeteIds.has(m.id) && aktuellerStatus(m) === 'aktiv')
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  let kegelabend: Kegelabend | undefined;
  if (kegelabende) {
    kegelabend = kegelabende.find((ka) => ka.datum === termin.beginn.slice(0, 10));
  }
  if (kegelabend) {
    termin.ort = kegelabend.ort;
  }

  return { termin, abgemeldet, erwartet, vergangen: termin.beginn < jetzt(), kegelabend: kegelabend };
}

/** Termine chronologisch; anstehende zuerst, vergangene danach absteigend. */
export function sortiereTermine(termine: readonly Kegeltermin[]): Kegeltermin[] {
  const stichtag = jetzt();
  const anstehend = termine
    .filter((t) => t.beginn >= stichtag)
    .sort((a, b) => a.beginn.localeCompare(b.beginn));
  const vergangen = termine
    .filter((t) => t.beginn < stichtag)
    .sort((a, b) => b.beginn.localeCompare(a.beginn));

  return [...anstehend, ...vergangen];
}

/** Der nächste anstehende Termin, falls es einen gibt. */
export function naechsterTermin(termine: readonly Kegeltermin[]): Kegeltermin | null {
  const stichtag = jetzt();
  return (
    termine
      .filter((t) => t.beginn >= stichtag)
      .sort((a, b) => a.beginn.localeCompare(b.beginn))[0] ?? null
  );
}

export function neuerTermin(beginn: Zeitpunkt, ort?: string, notiz?: string): Kegeltermin {
  return {
    id: crypto.randomUUID(),
    beginn,
    ...(ort ? { ort } : {}),
    ...(notiz ? { notiz } : {}),
    abmeldungen: [],
  };
}

export function neueAbmeldung(mitgliedId: string, grund: string): Abmeldung {
  return {
    id: crypto.randomUUID(),
    mitgliedId,
    grund: grund.trim(),
    gemeldetAm: jetzt(),
  };
}
