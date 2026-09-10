<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow Symbol" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Bewahre Umfang, Prüfgrenzen und aktuellen Fortschritt langer KI-Coding-Aufgaben über Sitzungen hinweg.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Was du mit Dev Flow tun kannst

Dev Flow hilft dir, lange KI-Programmieraufgaben in Codex oder DeepSeek zu verwalten. Es speichert
die vereinbarten Anforderungen, den Dateiumfang, den Prüfplan, den Fortschritt und die Ergebnisse
lokal, damit du nach dem Ende einer Sitzung weiterarbeiten kannst.

- **Umfang festhalten:** Erfasse die vorgesehenen Dateien und gleiche die tatsächlichen Änderungen mit dem Plan ab.
- **Tests planen:** Wähle passende Prüfungen und begrenze den Prüfaufwand.
- **Arbeit fortsetzen:** Setze dieselbe Aufgabe und die verbleibende Arbeit im ursprünglichen Verzeichnis fort.
- **Ergebnisse ansehen:** Prüfe Fortschritt, Testergebnisse und Probleme, die Aufmerksamkeit benötigen.

Das eignet sich für Arbeiten an einem Repository, die mehrere Sitzungen dauern oder klare Grenzen
für Dateien und Tests benötigen. Für einzelne Fragen, Code-Erklärungen und kleine Änderungen ohne
gespeicherten Fortschritt ist die direkte Nutzung von Codex oder DeepSeek meist einfacher.

## Schnellstart

> Die stabile npm-Version unter `@latest` ist derzeit auf macOS arm64 verifiziert. Verwende Node.js
> `>=24` und installiere zuerst eine unterstützte Version von Codex oder DeepSeek Harness. Die nötigen
> Host-Versionen und weitere Umgebungen stehen in der [Support-Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Dev Flow installieren

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Wähle in der interaktiven Einrichtung Codex, DeepSeek oder beide und folge den Hinweisen des Installers:

- **Codex:** Öffne `/hooks`, prüfe den Dev-Flow-Hook und vertraue ihm, um die unterstützten Prüfungen vor Schreibzugriffen zu aktivieren.
- **DeepSeek Harness:** Starte das ausgewählte DSH Profile nach der Installation neu.

### 2. Eine Aufgabe starten

Sende diese Nachricht in **Codex**:

```text
$dev-flow-codex:dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Oder in **DeepSeek Harness**:

```text
/dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Sende diese Nachrichten im Gespräch, nicht im Terminal. Beschreibe Ziel, Abnahmekriterien,
Dateiumfang und Testgrenze.

Die erste Antwort bewertet die Anfrage und fragt, ob du direkt oder mit Dev Flow arbeiten möchtest.
Bei Dev Flow wird standardmäßig im aktuellen Verzeichnis ein neuer Aufgabenbranch vom aktuellen HEAD
erstellt. Bestätige den Branch und ob vorhandene, noch nicht committete Änderungen zur Aufgabe gehören.
Abhängigkeiten, lokale Konfiguration, Dateien und Index bleiben erhalten. Die Sitzung wird fortgesetzt,
wenn sie auf alle beteiligten Verzeichnisse zugreifen kann.

Du kannst ausdrücklich den aktuellen Branch weiterverwenden oder einen eigenen Git-Worktree erstellen.
Für einen Worktree wählst du zusätzlich die lokale oder entfernte Quelle und den Ausgangsbranch. Codex
öffnet das neue Verzeichnis, wenn der Host dies unterstützt; DeepSeek liefert den passenden Neustartbefehl.

Pro Verzeichnis ist nur eine aktive Task möglich. Auch manuelle Änderungen und Änderungen anderer
Werkzeuge werden erfasst; ein Branchwechsel während der Aufgabe hält den Ablauf an. Lokale Verzeichnisse
und Branches bleiben nach Abschluss erhalten. Noch nicht committete Änderungen müssen beim Start der
nächsten Aufgabe berücksichtigt werden.

Besprich vor der Implementierung die Anforderungen, den Entwurf, die Arbeitsschritte, die vorgesehenen Dateien und den Prüfplan. Die Entwicklung beginnt erst nach deiner ausdrücklichen Zustimmung zum gesamten Plan. Änderungen am Plan oder ein erweiterter Dateiumfang erfordern eine erneute Zustimmung. Die Wahl von Dev Flow oder eines Worktrees ersetzt diese Zustimmung nicht.

### 3. Fortsetzen und Fortschritt ansehen

Kehre nach einem Sitzungsneustart zum ursprünglichen Verzeichnis zurück und bitte darum, die Aufgabe
fortzusetzen. Dev Flow arbeitet ab dem gespeicherten Fortschritt weiter. Fehlt das Verzeichnis oder
wurde es ersetzt, pausiert die Aufgabe, bis du es wiederherstellst oder die Aufgabe ausdrücklich aufgibst.

Füge in DeepSeek Harness auch der Nachricht zum Fortsetzen `/dev-flow` hinzu.

```bash
# Installierte Integrationen anzeigen
dev-flow status --host all

# Lokale Aufgabenansicht öffnen
dev-flow webui start
```

Nichtinteraktive Installation, eigene DSH Profiles, Updates, Reparatur und Entfernung beschreibt
die [Befehlsreferenz](docs/COMMANDS_en.md).

## Desktop-Maskottchen

Das Desktop-Maskottchen zeigt den gespeicherten Zustand einer ausgewählten Aufgabe und öffnet deren
WebUI. Du kannst Aufgaben auswählen, das Aussehen anpassen, Animationen steuern, die Größe ändern und
das Maskottchen unabhängig starten oder stoppen. Schließe vorher die oben beschriebene Installation
und Einrichtung von Codex oder DeepSeek ab.

```bash
dev-flow pet start
dev-flow pet stop
```

Die Desktop-Anwendungen sind für macOS arm64 und Windows 10/11 x64 vorgesehen. Installation und
Bedienung stehen im [Maskottchen-Handbuch](docs/DESKTOP-PETS_en.md), die verifizierte Verfügbarkeit
in der [Support-Matrix](docs/SUPPORT-MATRIX_en.md).

## Nutzungsgrenzen

Ein eigener Worktree trennt Codeänderungen. Prozesse, Netzwerkzugriff, Zugangsdaten und externe
Dienste bleiben mit deiner Umgebung geteilt.

Der Abschluss einer Aufgabe erstellt nicht automatisch Commits, führt keinen Push aus und löscht
keinen Worktree. Diese Vorgänge erfordern deine gesonderte Zustimmung.

## Dokumentation

- **Nutzung:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Befehle](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projekt:** [Produktbeschreibung](docs/PRODUCT_en.md) · [Support-Matrix](docs/SUPPORT-MATRIX_en.md) · [Sicherheit](SECURITY.md)
- **Entwicklung und Beiträge:** [Dokumentationsübersicht](MANIFEST_en.md) · [Beitragsleitfaden](CONTRIBUTING.md)

## Lizenz

[Apache License 2.0](LICENSE)
