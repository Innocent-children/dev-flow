<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Halte lange KI-Coding-Aufgaben innerhalb der festgelegten Änderungs- und Testgrenzen – und erkenne vor dem Fortsetzen, ob der aktuelle Stand noch vertrauenswürdig ist.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Wenn eine Coding-Aufgabe aus dem Ruder läuft

Angenommen, du bittest einen Agenten:

```text
Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

Die Aufgabe dauert länger. Der Agent möchte eine benachbarte Konfiguration ändern, derselbe Test schlägt
weiter fehl und die Sitzung startet vor den letzten Prüfungen neu. Aus dem Chat allein lässt sich kaum
ableiten, ob die zusätzliche Datei dazugehört, wie viel Testaufwand noch erlaubt ist, ob ein weiterer
Versuch neue Informationen bringt und ob alte grüne Ergebnisse noch zum aktuellen Code passen.

Dev Flow hält diese Entscheidungen bei der Aufgabe. Der Agent liest und ändert weiterhin Code und führt
Befehle aus; Umfangserweiterung, zusätzliche Tests, Wiederholungen und Abschluss werden sichtbare Entscheidungen.

## Was sich mit Dev Flow ändert

| Agent direkt | Mit Dev Flow |
| --- | --- |
| Dateigrenzen stehen nur im Prompt | Erwartete Dateien werden festgehalten; unterstützte ungeplante Schreibvorgänge warten auf deine Entscheidung |
| „Nur gezielte Tests“ kann offen wachsen | Automatische Prüfungen haben ein Limit; eine vollständige Suite braucht vorherige Erlaubnis |
| Derselbe Fehler führt zum nächsten ähnlichen Fix | Die dritte exakte Wiederholung stoppt und verlangt einen anderen Weg oder Zustimmung |
| Nach einem Neustart wird Fortschritt aus dem Chat rekonstruiert | Dieselbe Aufgabe, ihre Grenzen und übrigen Prüfungen werden fortgesetzt |
| Ein grüner Test überlebt spätere Codeänderungen | Nicht mehr passende Ergebnisse werden vor der Auslieferung verworfen |

## Die wichtigsten Unterschiede

### Die Aufgabe wächst nicht unbemerkt

Jeder Arbeitsschritt hält erwartete Dateien und nötige Prüfungen fest. Unterstützte Werkzeuge stoppen vor
einem ungeplanten Schreibvorgang; du erlaubst ihn einmal, änderst den Plan oder lehnst ihn ab. Vor Test
und Abschluss werden die tatsächlich geänderten Pfade erneut geprüft.

### Wiederholungen müssen neue Informationen liefern

Dev Flow vergleicht die letzten drei Testversuche und stoppt nur bei exakt demselben Fehler, Ergebnis
oder Pfad-und-Fehler-Muster. Ändern sich Anforderung, Plan oder Implementierung, gelten alte Tests und
Entwicklerbestätigungen nicht mehr.

### Fortsetzen ohne Raten oder blindes Wiederholen

Anfrage, Plan, Fortschritt, Prüfungen und Stop-Gründe werden lokal gespeichert. Eine neue Sitzung setzt
dieselbe Aufgabe fort. Ist ein Operationsergebnis unklar, werden gespeicherter Vorgang und aktuelles
Repository gelesen, bevor ein erneuter Versuch entschieden wird.

### Der Entwickler bestimmt den Abschluss

Bestandene Tests reichen nicht. Vor der Auslieferung prüft der Entwickler Änderungen, unnötige
Komplexität und Wartungsrisiken und bestätigt ausdrücklich, dass das Ergebnis erklärbar und wartbar ist.

### Die gesamte Aufgabe lokal ansehen

Der aktuelle Quellcode enthält ein lokales Control Center für Codex- und DeepSeek-Aufgaben, Fortschritt,
erwartete und tatsächliche Pfade, Testverlauf, Wiederholungsstopps und nächste Entscheidungen. Es ist kein Cloud-Dashboard.

## Schnellstart

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

```text
$dev-flow-codex:dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
/dev-flow Füge eine Rate-Limitierung für fehlgeschlagene Anmeldungen hinzu. Ändere nur Auth-Dateien und führe höchstens 4 gezielte Prüfungen aus.
```

## Geeignete Aufgaben

Dev Flow passt zu echter Repository-Arbeit über mehrere Sitzungen, mit klarer Dateigrenze, begrenztem
Testaufwand, möglicher Nacharbeit oder klarer Übergabe. Für einmalige Fragen, Erklärungen, Statusabfragen
und kleine mechanische Änderungen ist ein Agent allein meist einfacher.

## Tatsächlich verfügbar

### Stabiles npm `@latest`

| Produkt | Verifizierte Umgebung |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Stabile Nachweise decken Installation, Bereitschaft, Entfernung, Deinstallation und unverändertes Ziel-
Repository ab. Die stabile DeepSeek Journey umfasst auch Aktivierung, Neustart, Abschluss und erneutes Öffnen.

### Aktueller Quellcode und öffentliche Nachweise

- Der Quellcode enthält lokale WebUI, Dateiumfang-Entscheidungen, Wiederholungsbremse sowie `darwin-arm64` und `win32-x64`.
- Windows ist derzeit eine Quellcode-Funktion: Windows-11-Nachweise existieren, aber keine stabile Host Journey.
- [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) dokumentiert eine echte Codex Journey mit Neustart, Refactoring, Retest, Verständnisprüfung, Auslieferung und Abschluss.

### Noch nicht belegt oder stabil

- Weniger Testkosten, Defekte oder Wartungsaufwand sind extern nicht belegt; langfristige Nutzung ist begrenzt.
- Linux, Windows Server, 32-Bit/ARM64 Windows, Intel Mac, Rosetta und remote MCP sind nicht stabil unterstützt.
- Teamansicht, Cloud-Synchronisierung, Task-Export und ausdrückliche Host-Übergabe sind Zukunftsarbeit.

## Grenzen und Dokumentation

- Core beobachtet Git nur lesend und führt weder commit, push, merge, rebase, tag noch publish aus.
- Die Vorabprüfung deckt nur aufgeführte strukturierte Werkzeuge ab; Dev Flow ist keine Shell- oder Dateisystem-Sandbox.
- WebUI ist lokal, loopback und für einen Benutzer.
- [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md) · [Architecture](docs/ARCHITECTURE_en.md) · [Commands](docs/COMMANDS_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md)

## Lizenz

[Apache License 2.0](LICENSE)
