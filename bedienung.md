# Vereinsverwaltung — Bedienung

Diese Anleitung beschreibt die tägliche Arbeit mit der Anwendung: Kegelabende
erfassen, Beiträge buchen, abrechnen und das Kegeljahr abschließen.

---

## Die beiden Bereiche

Die Anwendung hat zwei Teile, die sich in ihrem Zweck deutlich unterscheiden.

**Die Vereinsseite** — Hauptseite, Satzung, Kegeltermine — ist für alle da. Hier
sieht man, wann als Nächstes gekegelt wird und wer sich abgemeldet hat. Änderungen
werden hier **sofort gespeichert**; es gibt kein „Änderungen speichern“.

**Die Verwaltung** — Mitglieder, Buchführung, Abrechnung, Jahresabschluss — ist
die Arbeitsumgebung von Kassenwart und Schriftführer. Hier werden Änderungen
gesammelt und erst auf Knopfdruck festgeschrieben.

Der Unterschied hat einen Grund: Wer sich abmeldet, erwartet, dass es unmittelbar
gilt. Wer dagegen eine Reihe von Buchungen erfasst, will sie prüfen können, bevor
sie gelten.

---

## Anmelden

Auf der Hauptseite steht links der Anmeldebereich. Rolle aus der Liste wählen,
Passwort eingeben, **Login** drücken. Oben erscheint dann, als wer man angemeldet
ist; **Logout** meldet wieder ab.

Die Anmeldung übersteht ein Neuladen der Seite, endet aber beim Schließen des
Browser-Tabs. Auf einem gemeinsam genutzten Rechner bleibt so niemand
versehentlich angemeldet.

Rollen sind keine Personen, sondern Ämter: „Kassenwart“, „Schriftführer“,
„Mitglied“. Eine Rolle kann einem Mitglied zugeordnet sein — dann weiß die
Anwendung, wer angemeldet ist. Welche Rolle was darf, steht unter
[Rollen](#rollen).

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

Der Knopf in der oberen Leiste wechselt das Erscheinungsbild. Zur Auswahl stehen
das helle Grundthema, das dunkle Terminal-Thema und das Kegelbahn-Thema mit
warmen Holztönen. Die Wahl bleibt gespeichert.

Beim Drucken werden Farben und Schriftart unabhängig vom Thema auf eine gut
lesbare Form gebracht — sonst käme im Terminal-Thema hellgraue Schrift auf
weißes Papier.

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

## Kegeltermine

Die Planung der kommenden Kegelabende: Wann wird gekegelt, und wer ist
verhindert?

Die Seite liegt auf der Vereinsseite, nicht in der Verwaltung. **Änderungen
werden sofort gespeichert** — es gibt kein „Änderungen speichern“ und kein
„Verwerfen“. Die Termine liegen dafür in einer eigenen Datei, unabhängig von
Buchführung und Kegeljahr.

Auf der Hauptseite erscheint zusätzlich der nächste anstehende Termin mit seinen
Abmeldungen, ohne dass man diese Seite öffnen müsste.

### Termin anlegen

Beginn mit Datum **und Uhrzeit** eintragen, dazu optional Ort und eine Notiz.
Vorgeschlagen ist der nächste Freitag um 19:30 Uhr. Liegt der Termin in der
Vergangenheit, fragt die Anwendung nach.

Anstehende Termine stehen oben, die vergangenen darunter — letztere zurückgenommen
dargestellt und ohne die Möglichkeit, sich nachträglich abzumelden.

### Abmelden

**Abmeldung eintragen** öffnet ein Feld: Mitglied auswählen, Grund angeben,
fertig. Der Zeitpunkt der Meldung wird automatisch festgehalten.

Zur Auswahl stehen aktive Mitglieder, die noch nicht abgemeldet sind. Gastkegler
erscheinen nicht — sie sind nicht verpflichtet zu kommen und müssen sich folglich
auch nicht abmelden.

Meldet sich jemand ein zweites Mal ab, ersetzt das den bisherigen Eintrag; so
lässt sich ein Grund nachträglich richtigstellen. **Zurücknehmen** entfernt die
Abmeldung wieder, wenn jemand doch kommt.

Je Termin zeigt die Anwendung, wie viele erwartet werden und wie viele sich
abgemeldet haben. Als erwartet gelten alle aktiven Mitglieder ohne Abmeldung.

### Aus einem Termin einen Kegelabend machen

Ist ein Termin vorbei, erzeugt **Kegelabend erzeugen** daraus den zugehörigen
Kegelabend in der Verwaltung. Übernommen werden Datum, Ort und alle aktiven
Mitglieder als Teilnehmer. Wer sich abgemeldet hat, wird als abwesend eingetragen
— samt der Absageart, die sich aus dem Zeitpunkt der Abmeldung ergibt:

| Abmeldung | Absageart | Gebühr |
|---|---|---|
| mindestens 48 Stunden vorher | rechtzeitig | 4,00 € |
| später | kurzfristig | 12,00 € |

Anschließend öffnet sich der neue Kegelabend, wo die Spielrunden erfasst werden.
Anders als sonst in der Verwaltung wird dabei sofort gespeichert — sonst ginge
der Abend beim nächsten Laden verloren, weil die Terminseite keinen
Speichern-Knopf anbietet.

Wurde zu einem Termin bereits ein Kegelabend angelegt, steht das an seiner Stelle
und der Knopf verschwindet.

---

## Kegelabende

### Abend anlegen

Auf der Übersichtsseite Datum und optional den Ort eintragen, dann **Anlegen**.
Alle aktiven Mitglieder werden automatisch als anwesend eingetragen.

Die Statusspalte zeigt, ob ein Abend bereits **abgerechnet** oder noch **offen** ist.

### Teilnehmer

In der Detailansicht (Klick auf das Datum):

- **Anwesend** abhaken oder entfernen.
- **Absage** wählen, sobald jemand als abwesend geführt wird.
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

### Absagen

Wer nicht da war, hat entweder abgesagt oder ist unangekündigt ferngeblieben. Die
Spalte **Absage** hält fest, was zutrifft:

| Eintrag | Bedeutung | Gebühr |
|---|---|---|
| rechtzeitig | mindestens 48 Stunden vor dem Termin abgemeldet | 4,00 € |
| kurzfristig | später abgemeldet | 12,00 € |
| nicht erschienen | gar nicht abgemeldet | 20,00 € |

Bei einem aus einem Termin erzeugten Kegelabend ist der Eintrag bereits gesetzt.
Hakst du jemanden von Hand als abwesend ab, musst du ihn wählen — solange die
Angabe fehlt, ist das Übernehmen der Strafen gesperrt und die betroffenen Namen
stehen als Hinweis darüber. Ohne Eintrag fiele nämlich gar keine Gebühr an, und
niemand käme darauf, warum.

### Auswertung und Strafen

Unten stehen Siege, Niederlagen und die Strafsumme je Teilnehmer, laufend
aktualisiert. Die Strafsätze:

| Anlass | Betrag |
|---|---|
| Verspätung | 1,00 € je Stunde |
| Absage rechtzeitig | 4,00 € |
| Absage kurzfristig | 12,00 € |
| nicht erschienen | 20,00 € |
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

Bei allen vier Vorgängen ist das heutige Datum vorbelegt. Gebucht wird aber
meist auf einen zurückliegenden Stichtag — den Monatsersten oder den Kegelabend.
Steht noch das heutige Datum, weist die Anwendung am Feld darauf hin und fragt
vor dem Buchen nach.

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

Das betroffene Mitglied steht in einer eigenen Spalte und wird über die in der
Buchung hinterlegte Zuordnung ermittelt — nicht über den Buchungstext. Eine
Umbenennung wirkt sich dadurch überall zugleich aus. Steht dort ein roter
Eintrag, verweist die Buchung auf ein gelöschtes Mitglied.

**Bearbeiten** lädt eine Buchung in das Formular oben, das dabei sichtbar den
Modus wechselt. Nützlich etwa, um eine Buchung nachträglich einem Mitglied
zuzuordnen.

**Kopieren** übernimmt eine Buchung als Vorlage ins Formular, ohne sie zu
ersetzen — praktisch für Reihen gleichartiger Buchungen wie mehrere Bahnmieten.
Vor dem Buchen lässt sich noch alles anpassen.

**Mehrere auf einmal löschen:** Über die Auswahlfelder links lassen sich Zeilen
markieren; der Haken in der Kopfzeile wählt alle Zeilen der aktuellen Seite. Über
der Tabelle erscheint dann eine Leiste mit Anzahl, Summe und der Möglichkeit,
alle Ausgewählten zu löschen. Ein Wechsel des Filters hebt die Auswahl auf, damit
nicht versehentlich unsichtbare Zeilen mitgelöscht werden.

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

### Bilanz und Gewinn- und Verlustrechnung

Die Seite zeigt den Anhang für die Generalversammlung: Eröffnungsbilanz,
Schlussbilanz und die Gewinn- und Verlustrechnung. Über **Anzeigen** klappt die
Aufstellung auf, **Als PDF herunterladen** erzeugt sie als Datei
`bilanz_JJJJMMTT.pdf`.

Die Zahlen ergeben sich laufend aus den Buchungen — der Abschluss selbst ist
dafür nicht nötig. Auch mitten im Jahr lässt sich so der Stand ablesen.

| Aufstellung | Grundlage |
|---|---|
| Eröffnungsbilanz | die Eröffnungsbuchungen, also der aus dem Vorjahr übernommene Bestand |
| Schlussbilanz | alle Buchungen des Kegeljahres |
| Gewinn- und Verlustrechnung | Erträge und Aufwendungen des Kegeljahres |

Als Gegenprobe muss die Veränderung des Vereinsvermögens zwischen beiden
Bilanzen dem Jahresergebnis entsprechen. Weicht das ab, weist die Anwendung
darauf hin — dann fehlt meist eine Gegenbuchung.

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

## Rollen

Wer sich anmelden kann und was er darf, steht unter **Rollen** in der Verwaltung.
Die Seite ist selbst geschützt: Sie verlangt bei jedem Vorgang den eigenen
Rollennamen und das Passwort, weil es keine Sitzung gibt, die sie sich merkt. Der
Name ist mit der angemeldeten Rolle vorbelegt.

**Rollen anzeigen** lädt die Liste. Sichtbar wird sie nur für Rollen mit dem
Recht „Verwaltung“ — wer die Rechte anderer einsehen will, muss sie auch vergeben
dürfen.

### Berechtigungen

| Recht | Erlaubt |
|---|---|
| Verwaltung | Mitglieder, Buchführung, Abrechnung, Jahresabschluss, Sicherungen, Rollen |
| Terminplanung | Termine anlegen und löschen |
| Von Terminen abmelden | sich und andere von Terminen abmelden |

### Anlegen, Bearbeiten, Duplizieren

Unten auf der Seite steht ein Formular, das beides leistet. Ist keine Rolle
gewählt, legt es eine neue an; über **Bearbeiten** in der Tabelle lädt es eine
vorhandene, was Überschrift und Knopfbeschriftung ändern. **Duplizieren**
übernimmt die Rechte einer Rolle in ein neues Formular — praktisch, um mehrere
gleichartige Rollen anzulegen.

Beim Bearbeiten bedeutet ein leeres Passwortfeld „unverändert“. Das
Wiederholungsfeld daneben verhindert Tippfehler.

Optional lässt sich einer Rolle ein **Mitglied** zuordnen. Nötig ist das nicht —
ein Amt wie „Kassenwart“ kann von wechselnden Personen genutzt werden.

> **Geschützt:** Der letzten Rolle mit dem Recht „Verwaltung“ lässt sich dieses
> Recht weder entziehen, noch kann sie gelöscht werden. Sonst käme niemand mehr
> an die Rollenverwaltung, und reparieren ließe sich das nur noch von Hand auf
> dem Server.

Passwörter werden nie im Klartext gespeichert — in der Rollendatei steht nur ein
Hash, aus dem sich das Passwort nicht zurückrechnen lässt. Die Prüfung geschieht
auf dem Server, nicht im Browser.

---

## Typische Abläufe

**Nach einem Kegelabend**
Kegeltermine → beim vergangenen Termin **Kegelabend erzeugen** → Teilnehmer und
Anwesenheit prüfen → Runden erfassen → Strafen übernehmen →
**Änderungen speichern**

Ohne vorher angelegten Termin: Kegelabende → Anlegen → weiter wie oben.

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

**Die Anmeldung ist nach einem Tab-Wechsel weg**
Das ist so gewollt: Die Anmeldung endet mit dem Browser-Tab. Ein Neuladen mit F5
übersteht sie dagegen.

**„Strafen übernehmen“ lässt sich nicht drücken**
Entweder beträgt die Strafsumme null, oder bei einem Abwesenden fehlt die
Absageart. Die betroffenen Namen stehen als Hinweis über dem Knopf.

**Der Kegelabend aus einem Termin taucht nicht auf**
Prüfen, ob überhaupt ein Kegeljahr geladen ist — ohne eines läuft das Anlegen ins
Leere. Die Kopfleiste zeigt das aktuelle Kegeljahr an.
