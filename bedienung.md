# Vereinsverwaltung — Bedienung

Diese Anleitung beschreibt die tägliche Arbeit mit der Anwendung: Kegelabende
erfassen, Beiträge buchen, abrechnen und das Kegeljahr abschließen.

---

## Grundlegendes

### Speichern

Die Anwendung speichert **nicht** automatisch. Änderungen bleiben zunächst nur
im Browser und wandern erst auf den Server, wenn du auf **„Änderungen
speichern“** drückst. Der Knopf steht oben rechts auf jeder Seite und ist nur
aktiv, wenn es etwas zu speichern gibt.

Zwei Anzeigen helfen dabei:

- Ein oranger Punkt in der oberen Leiste bedeutet: es gibt ungespeicherte Änderungen.
- Daneben erscheint dann der Knopf **„Verwerfen“**, der alles seit dem letzten
  Speichern rückgängig macht und den Serverstand neu lädt.

Das ist bewusst so: Bei jedem Speichern legt der Server zusätzlich eine
Sicherungskopie an. Automatisches Speichern nach jedem Tastendruck würde diese
Sicherungen nach kurzer Zeit unbrauchbar machen.

> **Wichtig:** Schließt du den Browser ohne zu speichern, sind die Änderungen weg.

### Kegeljahr wechseln

Gibt es mehr als ein Kegeljahr, steht oben rechts eine Auswahlliste. Der Wechsel
verwirft ungespeicherte Änderungen — die Anwendung fragt vorher nach.

### Darstellung umschalten

Der kleine Knopf `>_` in der oberen Leiste wechselt zwischen hellem Erscheinungsbild
und dunklem Terminal-Thema. Die Wahl bleibt gespeichert.

---

## Einmalige Einrichtung

Beim ersten Aufruf ist die Anwendung noch nicht mit dem Server verbunden. In der
oberen Leiste steht dann **„Nicht verbunden“**.

1. **Einstellungen** öffnen.
2. **API-Adresse** eintragen: `api/api.php`
3. **API-Key** eintragen (steht in der Datei `config.php` auf dem Server).
4. **Verbinden** drücken.

Die Zugangsdaten merkt sich der Browser. Beim nächsten Start verbindet sich die
Anwendung von selbst. Zum Wechseln auf einen anderen Server oder Browser trägst
du sie erneut ein.

---

## Mitglieder

Die Seite zeigt zwei bis drei Gruppen: **Vereinsmitglieder**, **Gastkegler** und
— sofern vorhanden — **Ausgetreten**. Jede Gruppe hat ihre eigene Summenzeile,
damit Gästeforderungen die Vereinssumme nicht verfälschen.

### Mitglied aufnehmen

Unten Name, Status, optional das Amt und das Eintrittsdatum eintragen, dann
**Aufnehmen**.

Das Eintrittsdatum ist wichtiger, als es aussieht: Beiträge werden anhand des
Status **zum jeweiligen Buchungsdatum** berechnet. Wer im März eintritt, zahlt
ab März.

Gleiche Namen werden abgewiesen — auch bei abweichender Schreibweise. „Müller“,
„mueller“ und „ Müller “ gelten als dieselbe Person.

### Status ändern

Die Auswahlliste in der Tabelle setzt den neuen Status **ab heute**. Für
rückwirkende Änderungen den Verlauf verwenden.

| Status | Bedeutung |
|---|---|
| aktiv | volles Mitglied, zahlt den vollen Beitrag |
| passiv | zahlt den ermäßigten Beitrag |
| Gastkegler | zahlt keinen Beitrag, aber Strafen aus Spielabenden |
| ausgetreten | zahlt nichts mehr, bleibt mit seiner Historie erhalten |

### Statusverlauf

Über **„Verlauf“** klappt die Historie eines Mitglieds auf. Dort lassen sich
Statuswechsel mit beliebigem Datum eintragen — auch rückwirkend — und falsche
Einträge wieder entfernen. Der letzte verbleibende Eintrag kann nicht gelöscht
werden.

### Entfernen

Für Austritte den Status auf „ausgetreten“ setzen, **nicht** entfernen. Ein
gelöschtes Mitglied verliert die Verbindung zu seinen Buchungen und Spielabenden.
Endgültiges Entfernen ist nur für Fehleingaben gedacht.

---

## Kegelabende

### Abend anlegen

Auf der Übersichtsseite Datum und optional den Ort eintragen, dann **Anlegen**.
Alle aktiven Mitglieder werden automatisch als anwesend eingetragen.

Die Statusspalte zeigt, ob ein Abend bereits **abgerechnet** oder noch **offen** ist.

### Teilnehmer

In der Detailansicht (Klick auf das Datum):

- **Anwesend** abhaken oder entfernen.
- **Verspätung, Pumpen, Neuner, Eingeholt, Schnaps** je Teilnehmer eintragen.
- Weitere Mitglieder über die Auswahlliste **hinzufügen** — etwa passive Mitglieder,
  die diesmal mitkegeln.
- Neue Gäste über **„Neuer Gastkegler“** anlegen; sie werden dabei automatisch
  als Mitglied mit dem Status „Gastkegler“ geführt.

### Spielrunden erfassen

Oben ein Spiel auswählen, dann **„Runde hinzufügen“**. Es entsteht eine Spalte im
Raster, in der alle Anwesenden zunächst als „mitgespielt“ stehen.

Ein Klick auf eine Zelle schaltet weiter:

| Zeichen | Bedeutung |
|---|---|
| `·` | nicht dabei |
| `○` | mitgespielt |
| `S` | Sieg |
| `N` | Niederlage |

In der Regel musst du also nur Sieger und Verlierer markieren.

### Auswertung und Strafen

Unten stehen Siege, Niederlagen und die Strafsumme je Teilnehmer, laufend
aktualisiert. Die Strafsätze:

| Anlass | Betrag |
|---|---|
| Verspätung | 1,00 € je Stunde |
| Pumpe | 0,10 € (nur bei Anwesenheit) |
| Teilnahme | 0,10 € |
| Niederlage | 0,25 € |
| Niederlage bei Fuchsjagd oder Totenkiste | 0,50 € |
| Fuchsjagd, Teilnahme in einer Runde mit Sieger | 0,25 € |

Sonderfälle: Reine Teilnahme an der Totenkiste ist straffrei, ebenso Fuchsjagd
ohne Sieger. Neuner, Eingeholt und Schnaps werden nur gezählt, nicht berechnet.

### Abrechnen

**„Strafen in die Buchführung übernehmen“** erzeugt je Teilnehmer eine Buchung:
Forderungen (100) an Strafen (310).

Danach ist der Abend **schreibgeschützt** — Runden und Statistiken lassen sich
nicht mehr ändern, weil die Beträge jetzt in der Buchführung stehen.

Muss doch etwas korrigiert werden:

1. **„Abrechnung zurücknehmen“** — löscht die zugehörigen Buchungen wieder.
2. Korrigieren.
3. Erneut übernehmen.

Von Hand ergänzte Buchungen bleiben dabei unberührt.

---

## Geschäftsvorfälle

Die vier wiederkehrenden Vorgänge, jeweils mit Vorschau vor dem Buchen.

Jeder Vorgang setzt die Buchungskonten automatisch. Wer die Buchungen im Journal
nachvollziehen möchte, findet sie hier aufgeschlüsselt — die Kontonummern
stehen dort in den Spalten „Soll“ und „Haben“.

### Der Kontenrahmen

| Nr. | Konto | Art |
|---|---|---|
| 000 | Eröffnungsbilanzkonto | nur beim Jahreswechsel |
| 100 | Forderungen | was Mitglieder schulden |
| 110 | Kasse | Bargeldbestand |
| 200 | Vereinsvermögen | Eigenkapital |
| 210 | Restguthaben | was der Verein Mitgliedern schuldet |
| 220 | Schulden gegenüber Dritten | |
| 250 | GuV-Konto | Jahresergebnis, wird errechnet |
| 300 | Beiträge | Ertrag |
| 310 | Strafen | Ertrag |
| 320 | Umlagen | Ertrag |
| 330 | Sonstige Erträge | Ertrag |
| 400 | Kegelbahn | Aufwand |
| 410 | Vereinsrunden | Aufwand |
| 420 | Generalversammlung | Aufwand |
| 430 | Sonstige Aufwendungen | Aufwand |

### Monatsbeiträge

Buchungsdatum und die beiden Beitragssätze eintragen. Die Vorschau zeigt, wer
wie viel zahlt. Maßgeblich ist der Status **zum Buchungsdatum** — Gastkegler und
Ausgetretene bleiben außen vor.

**Buchung je Mitglied:** Forderungen (100) an Beiträge (300)

Der Beitrag wird also zunächst nur als Forderung erfasst — in der Kasse landet er
erst beim Zahlungseingang.

### Zahlungseingänge

Die Liste zeigt alle Mitglieder mit offenen Forderungen. Betrag eintragen oder
über **„offenen Betrag“** übernehmen.

Zahlungen tilgen in dieser Reihenfolge: erst Beiträge, dann Strafen, dann
Umlagen. Wer mehr zahlt als offen ist, bekommt den Rest als Restguthaben
gutgeschrieben.

**Buchungen:**

| Anteil | Soll | Haben |
|---|---|---|
| bis zur Höhe der offenen Forderung | Kasse (110) | Forderungen (100) |
| darüber hinaus gezahlt | Kasse (110) | Restguthaben (210) |

### Restguthaben verrechnen

Rechnet vorhandenes Guthaben gegen offene Forderungen auf, in derselben
Reihenfolge. Die Vorschau zeigt, wen es betrifft.

**Buchungen, je Forderungsart ein Paar:**

| Schritt | Soll | Haben |
|---|---|---|
| Guthaben auflösen | Restguthaben (210) | Kasse (110) |
| Forderung tilgen | Kasse (110) | Forderungen (100) |

Der Umweg über die Kasse sieht ungewöhnlich aus, ist aber gewollt: So erscheint
die Verrechnung im Journal wie eine Zahlung und lässt sich genauso nachvollziehen.
Der Kassenbestand bleibt dabei unverändert, weil beide Buchungen sich aufheben.

### Geburtstagsumlage

Ausrichter auswählen, dann die Teilnehmer anhaken. 10 € je Person; über das Feld
„Zusatzpersonen“ lassen sich Begleitungen erfassen. Die Summe wird dem Ausrichter
als Restguthaben gutgeschrieben.

**Buchungen:**

| Vorgang | Soll | Haben |
|---|---|---|
| je Teilnehmer | Forderungen (100) | Umlagen (320) |
| Gutschrift an den Ausrichter | Umlagen (320) | Restguthaben (210) |

---

## Journal

Alle Buchungen des Kegeljahres, neueste zuerst.

**Filtern** nach Text, Zeitraum, Konto und Mitglied — beliebig kombinierbar. Die
Summenzeile bezieht sich immer auf den gesamten Filter, nicht nur auf die
sichtbare Seite.

**Bearbeiten** lädt eine Buchung in das Formular oben, das dabei sichtbar den
Modus wechselt. Nützlich etwa, um eine Buchung nachträglich einem Mitglied
zuzuordnen.

**Neue Buchung** für alles, was kein Standardvorgang ist. Hier wählst du Soll-
und Habenkonto selbst. Häufige Fälle:

| Vorgang | Soll | Haben |
|---|---|---|
| Bahnmiete bar bezahlt | Kegelbahn (400) | Kasse (110) |
| Vereinsrunde bar bezahlt | Vereinsrunden (410) | Kasse (110) |
| Generalversammlung | Generalversammlung (420) | Kasse (110) |
| sonstige Ausgabe | Sonstige Aufwendungen (430) | Kasse (110) |
| sonstige Einnahme | Kasse (110) | Sonstige Erträge (330) |

Für Beiträge, Zahlungen und Umlagen besser die Geschäftsvorfälle nutzen, dort
werden die Gegenkonten automatisch richtig gesetzt.

---

## Konten

Die Kontenübersicht zeigt Vermögen, Verbindlichkeiten, Erträge und Aufwendungen
sowie das Jahresergebnis.

Über **Datum ab / bis** lässt sich ein Zeitraum eingrenzen. Achtung: Dann zeigen
die Zahlen die **Bewegungen im Zeitraum**, nicht die Bestände — Werte können
negativ sein, wenn die Eröffnungsbuchungen außerhalb liegen. Die Anwendung weist
darauf hin, und die Spaltenüberschrift wechselt von „Saldo“ auf „Bewegung“.

Die **Gegenprobe** unten prüft, ob Vermögen den Verbindlichkeiten zuzüglich
Vereinsvermögen entspricht. Geht sie nicht auf, fehlt eine Gegenbuchung.

---

## Abrechnung

Die Liste für den Kegelabend: wer schuldet was.

- **Stand** legt den Stichtag fest.
- **Ausgleich** zeigt, was durch vorhandenes Restguthaben gedeckt wäre. Gebucht
  wird dabei nichts — die tatsächliche Verrechnung läuft über die
  Geschäftsvorfälle.
- **Summe** ist der zu zahlende Betrag.
- **bezahlt** bleibt im Ausdruck leer, zum Abhaken vor Ort.

**„PDF herunterladen“** erzeugt die Liste im Querformat als
`abrechnung_JJJJMMTT.pdf`.

Erscheint ein Warnhinweis über nicht zugeordnete Forderungen, gehören diese
Beträge zu keinem Mitglied und fehlen deshalb in der Liste. Im Journal lässt sich
die Zuordnung nachtragen.

---

## Jahresabschluss

### Das erste Kegeljahr anlegen

Auf einem frisch eingerichteten Server gibt es noch kein Kegeljahr — und ohne
eines lässt sich nichts buchen. Die Seite **Jahresabschluss** bietet dann oben
das Anlegen an: Beginn und Ende eintragen, vorgeschlagen ist der übliche Zeitraum
vom 1. Oktober bis zum 30. September. Das Ende richtet sich nach dem Beginn und
lässt sich anpassen.

Alle weiteren Jahre entstehen später über den Abschluss, damit die Bestände
lückenlos übertragen werden. Werden Altdaten importiert, entfällt dieser Schritt —
die Kegeljahre kommen dann aus der Importdatei.

### Ein Kegeljahr abschließen

Am Ende des Kegeljahres:

1. Zuerst alle offenen Vorgänge buchen (letzte Beiträge, Zahlungseingänge).
2. **Jahresabschluss** öffnen und die vier Bestände mit den eigenen Zahlen abgleichen.
3. **„Abschluss vorbereiten“** — es erscheint eine Vorschau aller
   Eröffnungsbuchungen für das Folgejahr.
4. Prüfen, ob das **Eröffnungsbilanzkonto ausgeglichen** ist und ob Warnungen
   erscheinen.
5. **„Jahr abschließen“**.

Übertragen werden Kasse, Forderungen, Restguthaben und Vereinsvermögen. Erträge
und Aufwendungen beginnen im neuen Jahr wieder bei null — sie sind im
Vereinsvermögen bereits verrechnet.

**Eröffnungsbuchungen im neuen Jahr:**

| Bestand | Soll | Haben |
|---|---|---|
| Vereinsvermögen | Eröffnungsbilanzkonto (000) | Vereinsvermögen (200) |
| Kasse | Kasse (110) | Eröffnungsbilanzkonto (000) |
| Restguthaben je Mitglied | Eröffnungsbilanzkonto (000) | Restguthaben (210) |
| Forderung je Mitglied | Forderungen (100) | Eröffnungsbilanzkonto (000) |

Das Eröffnungsbilanzkonto (000) ist dabei nur ein Durchgangsposten: Am Ende muss
es auf beiden Seiten denselben Betrag aufweisen. Genau das prüft die Vorschau.

Das abgeschlossene Jahr bleibt vollständig erhalten und ist über den
Jahresumschalter weiter einsehbar. Der Abschluss wird sofort gespeichert und
lässt sich nicht rückgängig machen; auf dem Server liegt eine Sicherungskopie
des vorherigen Standes.

---

## Sicherungen

Vor jedem Speichern legt der Server eine Kopie des vorherigen Standes ab. Die
Seite **Sicherungen** zeigt sie an und erlaubt, zu einem älteren Stand
zurückzukehren.

Mitglieder und Kegeljahre werden getrennt gesichert, deshalb sind die Stände nach
Datei gruppiert — neueste zuerst. Aufbewahrt werden je Datei die letzten 15
Stände, ältere fallen automatisch weg.

### Einen Stand zurückholen

1. **Ansehen** öffnet den gewählten Stand und zeigt, was darin steckt: bei
   Mitgliedern deren Anzahl, bei einem Kegeljahr die Bezeichnung samt Anzahl der
   Buchungen und Kegelabende.
2. **Diesen Stand laden** ersetzt damit die Anzeige — auf dem Server ändert sich
   dabei noch nichts.
3. Den geladenen Stand in Ruhe prüfen, etwa im Journal oder in der
   Mitgliederliste.
4. **Änderungen speichern**, um ihn festzuschreiben — oder **Verwerfen** in der
   oberen Leiste, um doch beim bisherigen Stand zu bleiben.

Auch das Festschreiben ist rückholbar: Beim Speichern legt der Server wie gewohnt
eine Sicherung des überschriebenen Standes an.

> **Hinweis:** Wird ein älterer Mitgliederstand geladen, in dem Personen fehlen,
> auf die das aktuelle Kegeljahr verweist, meldet die Anwendung das vor dem Laden.
> Gespeichert werden kann erst, wenn auch ein passender Kegeljahr-Stand geladen
> wurde.

---

## Typische Abläufe

**Nach einem Kegelabend**
Kegelabende → Anlegen → Teilnehmer und Anwesenheit prüfen → Runden erfassen →
Strafen übernehmen → **Änderungen speichern**

**Monatlich**
Geschäftsvorfälle → Monatsbeiträge buchen → Zahlungseingänge erfassen →
**Änderungen speichern** → Abrechnung → PDF für den nächsten Kegelabend

**Bei Ein- oder Austritt**
Mitglieder → aufnehmen bzw. Status auf „ausgetreten“ setzen (mit korrektem
Datum) → **Änderungen speichern**

---

## Wenn etwas klemmt

**„Nicht verbunden“ in der Leiste**
Die Zugangsdaten fehlen oder der Server ist nicht erreichbar. Unter Einstellungen
neu verbinden.

**Eine Zahl stimmt nicht**
Journal öffnen und nach dem Mitglied filtern — dort steht jede einzelne Buchung
mit Datum und Konten.

**Der Kegelabend lässt sich nicht bearbeiten**
Er ist abgerechnet. Unten „Abrechnung zurücknehmen“, korrigieren, erneut
übernehmen.

**Änderungen sind verschwunden**
Vermutlich wurde ohne Speichern neu geladen oder das Kegeljahr gewechselt. Über
die Seite **Sicherungen** lässt sich ein früherer Stand zurückholen.

**Versehentlich etwas gelöscht**
Solange noch nicht gespeichert wurde: „Verwerfen“ in der oberen Leiste. Danach
über die Seite **Sicherungen** den Stand von vor dem Speichern laden.
