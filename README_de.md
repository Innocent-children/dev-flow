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

Jede neue Anfrage wird vor der Auswahl von Dev Flow schreibgeschützt bewertet. Danach fragt der Host nach
einer lokalen oder entfernten Quelle, dem Ausgangsbranch und dem Namen des neuen Task-Branches. Bei einer
lokalen Quelle fragt er außerdem, ob vorgemerkte und nicht vorgemerkte Änderungen sowie nicht von Git ignorierte,
unversionierte Dateien kopiert werden sollen. Quellarbeitsverzeichnis und Indexzustand bleiben erhalten.
Die lokale Erstellung benötigt kein Netzwerk; nur die entfernte führt fetch aus. Konflikte stoppen die Task-Erstellung
und lassen den Zielarbeitsbaum zur Prüfung bestehen.

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
- **Abschluss und Wiederaufnahme bleiben nachvollziehbar.** Core verlangt den Abschluss aller geplanten Arbeitsschritte und verknüpft jedes Abnahmekriterium mit aktuell gültigen Prüfungen. Nach einer Unterbrechung stellt WebUI die in Core gespeicherten Einreichungen wieder her. Codex bewahrt vollständige Ablehnungsantworten auf und folgt den Anweisungen von Core, bevor es fortfährt.

## Schnellstart

> Die unter `@latest` auf npm veröffentlichte stabile Version ist derzeit auf macOS arm64 verifiziert. Installiere zuerst Node.js `>=24`
> und eine unterstützte Version von Codex oder DeepSeek Harness. Genaue Versionen und weitere Umgebungen
> stehen in der [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Dev Flow installieren

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

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

Codex übernimmt weiterhin gültige Entscheidungen und Freigaben, ohne zusätzliche Pausen zum bloßen Bestätigen der Fortsetzung. Bei offenen Entscheidungen oder fehlenden erforderlichen Angaben stellt es konkrete Fragen.

Oder sende in **DeepSeek Harness**:

```text
/dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Das sind Selektoren für die Unterhaltung, keine Shell-Befehle. Nenne ein konkretes Ziel, Abnahmekriterien,
die Dateigrenze und das Testlimit. Die erste Antwort bewertet die Auswirkungen und fragt nach direkter
Arbeit oder Dev Flow; auch ein expliziter Selektor überspringt diese Entscheidung nicht. Bei Dev Flow
bestätigst du Quelle, Basis- und Ziel-Branch sowie die Übernahme lokaler Änderungen. Codex öffnet einen verwalteten Worktree, wenn der Host das
unterstützt; DeepSeek zeigt den Neustart aus dem neuen Worktree, weil der Workspace Root der Sitzung feststeht.

Vor dem Start einer neuen Codex-Sitzung speichert die ursprüngliche Sitzung die relevante Anforderungsdiskussion im Original und eine strukturierte Übergabe. Dabei trennt sie bestätigte Anforderungen von nicht angenommenen Vorschlägen und offenen Fragen. Neue Desktop-Aufgaben und CLI-Neustarts verwenden dieselben gespeicherten Inhalte; lange Inhalte werden als vollständige Dateien ohne Kürzung übergeben. Siehe [Architektur](docs/ARCHITECTURE_en.md#codex-requirements-handoff).

Die Übergabe enthält sitzungsspezifische Anweisungen und Berechtigungen; Codex lädt die geltenden globalen und Repository-Dateien `AGENTS.md` regulär, ohne deren Inhalt in der Übergabe zu duplizieren. Notwendige Ergänzungen für Regeln, die in der Zielsitzung nicht automatisch gefunden werden, nennen Quelle und Geltungsbereich.

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

## Aufgaben vom Desktop aus öffnen

Das npm-Paket `@imotong/dev-flow` enthält das Desktop-Haustier für macOS arm64 und Windows 10/11 x64 mit neun Standardaktionen und 312 SVG-Einzelbildern. Es zeigt den gespeicherten Zustand der ausgewählten Task und öffnet deren WebUI. Es unterstützt Task-Auswahl, eigene Erscheinungsbilder, Animationssteuerung, Größenänderung sowie separates Starten und Stoppen. Ein eingerichteter Codex- oder DeepSeek-Adapter stellt Core bereit.

Nach der npm-Installation richtet `dev-flow install` einen Adapter ein. `install`, `upgrade`, `repair` und `reinstall` aktualisieren die Anwendungskopie und erhalten Einstellungen und Erscheinungsbilder. Siehe die [Haustieranleitung](docs/DESKTOP-PETS_en.md). macOS verwendet eine Ad-hoc-Signatur; Developer ID, Beglaubigung und Windows-Verteilungssignaturen sind noch nicht geprüft. Lokale Prüfungen erweitern den [stabilen Support](docs/SUPPORT-MATRIX_en.md) nicht.

```bash
dev-flow pet start
dev-flow pet stop
```

## Dokumentation

- **Verwendung:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projekt:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Lizenz

[Apache License 2.0](LICENSE)
