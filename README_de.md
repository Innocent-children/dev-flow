<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow Symbol" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Bewahre Umfang, Prüfgrenzen und aktuellen Fortschritt langer KI-Coding-Aufgaben über Sitzungen hinweg.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Lange Aufgaben auf Kurs halten

Je länger eine Coding-Aufgabe dauert, desto leichter verändert sie sich schleichend: Weitere Dateien
kommen hinzu, eine gezielte Prüfung wird zu einem Testlauf ohne Ende, derselbe Fehler löst einen ähnlichen
Versuch aus oder eine neu gestartete Sitzung muss den Fortschritt aus dem Chat rekonstruieren.

Dev Flow speichert die vereinbarte Anfrage, erwartete Pfade, den nach der Analyse erstellten Prüfplan, die aktuelle Phase und Ergebnisse
in einer lokalen Aufgabe. Codex oder DeepSeek ändert weiterhin den Code.

Jede neue Anfrage wird zuerst schreibgeschützt bewertet. Wenn du Dev Flow auswählst, bestätigst du Remote,
Basis-Branch und einen neuen Task-Branch; der Host erstellt von dieser entfernten Basis einen sauberen,
eigenen Worktree, bevor Core die Task anlegt. Änderungen aus dem Quell-Checkout werden nicht kopiert.

Die Repository-Suche und die Nutzung des Code-Index folgen den aktuellen Benutzeranweisungen und der
anwendbaren `AGENTS.md`. Verlangen diese einen Projektindex, untersucht der Host die möglichen
Repositories vor der Bestätigung schreibgeschützt und legt den bestätigten Umfang in der Task fest.
Diese Anweisungen haben Vorrang vor der Code-Index-Einstellung des Plugins.

- **Der Umfang bleibt klar.** Erwartete Pfade werden festgehalten, unterstützte strukturierte Werkzeuge
  fragen vor Schreibvorgängen außerhalb des Plans und tatsächliche Änderungen werden vor Tests und
  Auslieferung erneut geprüft.
- **Jeder Worktree hat genau einen Änderungsbesitzer.** Core ermittelt die tatsächlichen Änderungen der Task mit
  Git. Normale lineare Commits können fortgesetzt werden; Branch-Rewrites oder ein ersetzter Worktree stoppen die Task.
- **Der Prüfaufwand passt zur Aufgabe.** TASKS speichert Prüfungen, Gründe, Anfangsaufwand und Erwartungen
  für Vollsuite/Testcode. Nur konkrete neue Auswirkungen, Risiken, Fehler oder Lücken erhöhen das Budget.
- **Die Prüfung endet bei der aktuellen Änderung.** Danach werden nur Diff, kausale Auswirkungen und
  Abnahmebedarf geprüft; ein Fix löst nur verwandte Nachprüfungen aus, ein explizites Code Review bleibt schreibgeschützt.
- **Die Arbeit übersteht Neustarts.** Eine neue Sitzung stellt dieselbe Aufgabe, übrige Prüfungen und die
  aktuelle Entscheidung wieder her, statt sie aus dem Gespräch zu rekonstruieren.
- **Nur aktuelle Ergebnisse gelten weiter.** Änderungen an Anfrage, Plan, Implementierung oder Repository
  machen alte Prüfungen ungültig; vor der Auslieferung prüft der Entwickler das tatsächliche Ergebnis.
- **Abschluss und Wiederaufnahme bleiben nachvollziehbar.** Core verlangt den Abschluss aller geplanten Arbeitsschritte und verknüpft jedes Abnahmekriterium mit aktuell gültigen Prüfungen. Nach einer Unterbrechung stellt WebUI die in Core gespeicherten Einreichungen wieder her.

## Dateien zur Übermittlung vorbereiten

Vor der Übermittlung führt Codex `dev-flow-codex artifacts collect` und `dev-flow-codex artifacts prepare` aus. Core erfasst sämtliche Änderungen der aktuellen Action; Codex ordnet jede Datei ein und der Befehl erzeugt die Artefaktlisten. Bei Auslassungen werden die genauen Pfade und eine begrenzte Korrekturanweisung zurückgegeben. Prüfungen des Arbeitsbaums, des Verlaufs und der Knotenberechtigungen bleiben bestehen. Siehe [Dateien erfassen und übermitteln](docs/ARTIFACTS_en.md).

## Schnellstart

> Die unter `@latest` auf npm veröffentlichte stabile Version ist derzeit auf macOS arm64 verifiziert. Installiere zuerst Node.js `>=24`
> und eine unterstützte Version von Codex oder DeepSeek Harness. Genaue Versionen und weitere Umgebungen
> stehen in der [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Dev Flow installieren

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Das Lebenszyklusmenü zeigt den Zustand der installierten Adapter und bietet Zurück, Beenden, erneute Eingabe bei Fehlern sowie den Zugriff auf Control Center. Vor der Bestätigung erscheinen Versionen und betroffene Pfade. `install`, `repair` und `reinstall` behalten standardmäßig die installierte Version bei; `upgrade` wählt `latest`. Wiederholte Installation oder Reparatur eines intakten Adapters, bereits erfolgte Updates und abgeschlossene Entfernungen bleiben ohne Änderungen; `reinstall` ersetzt das Paket erneut. `doctor` zeigt fehlgeschlagene Prüfungen und passende Befehle. Optionen stehen unter `dev-flow repair --help`; der JSON-Modus stellt keine Fragen. Diese Befehle verwalten Adapter; den öffentlichen Launcher aktualisieren Sie mit `npm install -g @imotong/dev-flow@latest`.

Wähle im interaktiven Setup Codex, DeepSeek oder beide. Führe vor der ersten Aufgabe außerdem den letzten
vom Installer angezeigten Schritt aus:

- **Codex:** Öffne `/hooks`, prüfe den mitgelieferten Dev-Flow-Hook und vertraue ihm. Die unterstützte
  Schreibprüfung für `apply_patch` ist erst danach aktiv.
- **DeepSeek Harness:** Starte das ausgewählte DSH-Profil nach der Installation neu.

Der Adapter im aktuellen Quellcode benötigt DSH `>=0.1.2-rc.1`; jeder Dev-Flow-Vorgang prüft die direkt eingegebene Benutzerfreigabe im aktuellen Gesprächsschritt.

### 2. Eine Aufgabe starten

Sende in **Codex** diese Benutzernachricht:

```text
$dev-flow-codex:dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Oder sende in **DeepSeek Harness**:

```text
/dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Das sind Selektoren für die Unterhaltung, keine Shell-Befehle. Nenne ein konkretes Ziel, Abnahmekriterien,
die Dateigrenze und das Testlimit. Die erste Antwort bewertet die Auswirkungen und fragt nach direkter
Arbeit oder Dev Flow; auch ein expliziter Selektor überspringt diese Entscheidung nicht. Bei Dev Flow
bestätigst du Remote, Basis und Ziel-Branch. Codex öffnet einen verwalteten Worktree, wenn der Host das
unterstützt; DeepSeek zeigt den Neustart aus dem neuen Worktree, weil der Workspace Root der Sitzung feststeht.

Vor dem Start einer neuen Codex-Sitzung speichert die ursprüngliche Sitzung die relevante Anforderungsdiskussion im Original und eine strukturierte Übergabe. Dabei trennt sie bestätigte Anforderungen von nicht angenommenen Vorschlägen und offenen Fragen. Neue Desktop-Aufgaben und CLI-Neustarts verwenden dieselben gespeicherten Inhalte; lange Inhalte werden als vollständige Dateien ohne Kürzung übergeben. Siehe [Architektur](docs/ARCHITECTURE_en.md#codex-requirements-handoff).

### 3. Fortsetzen und Fortschritt prüfen

Bitte nach einem Sitzungsneustart ausdrücklich darum, die Task in ihrem ursprünglichen Worktree
fortzusetzen. Das System prüft diesen Worktree und setzt die Arbeit anhand des gespeicherten
Aufgabenstands fort. Die Anfrage wird nicht erneut bewertet, und du musst Dev Flow nicht erneut
wählen. Fehlt der ursprüngliche Worktree oder wurde er ersetzt, pausiert die Task, bis du ihn
wiederherstellst oder die Task ausdrücklich aufgibst (abandon). Das System wechselt nicht zu einem anderen Worktree.

```bash
# Installierte Integrationen prüfen
dev-flow status --host all

# Lokale Aufgabenansicht öffnen
dev-flow webui start
```

Nicht interaktive Installation, eigene DSH-Profile, Upgrades, Reparatur und Entfernung sind in der
[Command Reference](docs/COMMANDS_en.md) beschrieben.

## Wann es passt

Dev Flow eignet sich für Repository-Arbeit über mehrere Sitzungen, mit einer echten Dateigrenze,
begrenztem Testaufwand oder möglicher Nacharbeit, die keine veralteten Ergebnisse wiederverwenden darf.

Für einmalige Fragen, Codeerklärungen, Statusabfragen und kleine mechanische Änderungen ohne gespeicherten
Fortschritt ist Codex oder DeepSeek allein meist einfacher.

## Desktop-Maskottchen (macOS arm64)

Das lokale Paket enthält weiterhin das Standarderscheinungsbild. Das Walmädchen und andere eigene Erscheinungsbilder werden als separate Grafikpakete importiert; Anwendungsupdates erhalten die importierten Grafiken.

Das Desktop-Maskottchen ist für macOS arm64 als lokales Entwicklungspaket mit `DevFlowPet.app` verfügbar. Die regulären npm-Dateilisten und die Vorbereitung öffentlicher Releases enthalten die native App nicht. Ein fertig gebautes Paket benötigt zum Ausführen kein Swift/Xcode und nutzt den Core eines konfigurierten Codex- oder DeepSeek-Adapters. Es zeigt den gespeicherten Zustand einer Task und öffnet deren WebUI, ohne laufende Host-Aktivität oder Fortschrittsprozente abzuleiten. Beim Beenden bleiben Tasks und WebUI erhalten.

Importiert werden können ein statisches PNG oder SVG, ein natives PNG/SVG-Animationspaket oder ein Atlas im Codex-Format 1/2. Native Pakete benötigen fünf Aufgabenanimationen und können vier weitere enthalten; Codex-Atlanten ergeben neun Animationen und 57 Einzelbilder. Für Codex erfordert die hochauflösende Dev-Flow-Erweiterung zusätzlich einen Atlas mit Standardabmessungen. Verfügbare Grafiken bestimmen Laufen, Winken und Nachdenken im Leerlauf; dafür gibt es einen separaten Schalter, und Aufgabenmeldungen haben Vorrang. Programmaktualisierung und erneuter Grafikimport sind getrennte Vorgänge.

Die Menüleiste zeigt das geschwungene Dev-Flow-Logo einfarbig; die Farbe passt sich dem Erscheinungsbild des Systems an. Die Größe des Maskottchens lässt sich in sechs Stufen von 50% bis 200% einstellen; die Schriftgröße der Sprechblase bleibt gleich. Das Standardaussehen wird als separates Grafikpaket mit neun Animationen und 312 SVG-Einzelbildern mitgeliefert.

Solange keine Aufgabe ausgewählt ist, sucht das Haustier weiter nach neuen Aufgaben. Es wählt zuerst die zuletzt aktualisierte blockierte Aufgabe, andernfalls die zuletzt aktualisierte aktive Aufgabe. Die Auswahl bleibt bestehen, bis sie manuell geändert wird.

Bezug, Installation, Aktualisierung, Auslöseregeln, Grenzen und Fehlerbehebung stehen im [Desktop-Maskottchen-Handbuch](docs/DESKTOP-PETS_en.md). Die Support-Matrix definiert den öffentlichen Support.

```bash
dev-flow pet start
dev-flow pet stop
```

## Dokumentation

- **Verwendung:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projekt:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Lizenz

[Apache License 2.0](LICENSE)

## Anpassung für Windows-Desktop-PCs

Windows 10/11 x64 richtet sich an gewöhnliche Desktop-PCs mit 64-Bit-Prozessoren von Intel oder AMD. Die Regeln für Pfade, Berechtigungen, Befehle und Bereinigung des Hosts sind in `platform/windows/` und `platform/macos/` getrennt; Core teilt die plattformunabhängige Aufgabensemantik. Windows-Befehlsstarter verwenden UTF-8, und die Git-Beobachtung von Core blendet Konsolenfenster aus. Der [Anpassungsbericht](docs/WINDOWS-ADAPTATION_en.md) beschreibt die native Windows-Prüfung und ihre Grenzen; diese Ergebnisse erweitern nicht den Supportumfang stabiler Pakete.

Windows bietet jetzt auch das Desktop-Haustier: Aufgabenauswahl und Statusanzeigen, Infobereich-Menü, PNG/SVG-Gestalten, native Animationen, Codex-PNG/WebP-Atlanten, neun Aktionen, Ziehen, sechs Größen, Ausblenden/Wiederherstellen sowie unabhängiges Starten/Stoppen. Das lokale Windows-Paket wird mit `node scripts/build-desktop-pet-windows.mjs --output "C:\pet-build"` gebaut; Voraussetzungen und Installation stehen im [Desktop-Haustier-Handbuch](docs/DESKTOP-PETS_en.md). Windows- und macOS-Implementierung bleiben getrennt.
Unter Windows beendet eine Größenänderung die aktuelle Leerlaufaktivität und setzt die normale Ablaufplanung fort.

Unter Windows werden vorhandene AppData-Verzeichnisse auf ihre tatsächlichen Pfade aufgelöst, einschließlich Verzeichnisaliasen paketierter Desktop-Hosts; symbolische Links werden weiterhin abgelehnt.

Die aktuelle Windows-Entwicklungsversion enthält beide Adapter-Pakete und die Desktop-Anwendung. Nach der Installation des Starters verwenden Sie `dev-flow install --host all --yes` und `dev-flow pet start`. Reparatur und Neuinstallation nutzen denselben Einstieg, prüfen die Paket-Hashes, aktualisieren die Anwendung und behalten Task-Daten, Einstellungen und Gestalten bei.

`dev-flow-codex host-launch <operation>` liest ein UTF-8-JSON-Objekt von höchstens 1 MiB aus dem stdin-Stream und unterstützt aufgeteilte Eingaben sowie Mehrbytezeichen über Blockgrenzen hinweg. Lesefehler, ungültiges UTF-8, doppelte Mitglieder, ungültiges JSON, Arrays und null werden vor der Ausführung der Operation abgewiesen. Fehler gehen an stderr, erfolgreiche JSON-Ergebnisse an stdout.

## Befehlshilfe und Wiederaufnahme von Aufgaben

Die Befehlshilfe von Codex beschreibt Parameter für Arbeitsbaumoperationen, Rückgabefelder und den nächsten Schritt. Sobald alle Repositories vorbereitet sind, stellt der Host den gespeicherten Arbeitsbaumumfang zusammen. MCP-Ergebnis-Schemas zeigen, wo Task und Action gelesen werden; wiederaufgenommene Sitzungen bearbeiten zunächst ausstehende Übermittlungen.

```bash
dev-flow-codex --help
dev-flow-codex host-launch prepare --help
```

Parameter und Regeln zur Wiederaufnahme stehen in der [Befehlsreferenz](docs/COMMANDS_en.md).

`host-launch prepare` erzeugt bei ausgelassenem `launch_id` eine ID und verwendet sie zum Abgleich des Startdatensatzes. Übergeben Sie bei einem erneuten Versuch die zurückgegebene `receipt.launch_id`, um denselben Start fortzusetzen; bei einem Datensatz im Zustand `fetched` entfällt fetch. Eine explizite ID muss mit dem gespeicherten Datensatz übereinstimmen.

`host-launch dispatch-result` akzeptiert die vollständige Codex-Antwort zur Aufgabenerstellung, einschließlich JSON in `content[].text`. Es speichert `clientThreadId` als `host_client_thread_id` mit der Phase `queued`; ein gespeichertes Ergebnis kann mit derselben `launch_id` und demselben `repository_key` erneut übermittelt werden, um einen `uncertain`-Datensatz wiederherzustellen. Weitere Prüfungen verfolgen dieselbe Erstellung, ohne sie erneut auszulösen.

Codex speichert vollständige Anfragen zur Erstellung von Arbeitsbereichen zum erneuten Lesen. `dispatch-start` bereitet vor, `dispatch-call` erlaubt einen Aufruf, `dispatch-recover` setzt einen nachweislich noch nicht aufgerufenen Vorgang fort und `dispatch-reconcile` gleicht bei unbekanntem Ergebnis vorhandene Aufgaben ab. Der Aufrufer liest vollständige JSON-Dateien; fehlende Ergebnisse erlauben keine doppelte Erstellung.
