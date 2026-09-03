<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Mantén las tareas largas de programación con IA dentro de los límites de cambios y pruebas que definiste, y comprueba si el estado actual es fiable antes de continuar.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Cuando una tarea empieza a desviarse

Imagina que pides a un Agent:

```text
Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
```

La tarea se alarga. El Agent quiere tocar una configuración cercana, la misma prueba sigue fallando y
la sesión se reinicia antes de terminar. El chat ya no responde con seguridad si el archivo extra forma
parte del trabajo, cuántas pruebas quedan permitidas, si otro intento aportará algo o si un resultado
anterior sigue siendo válido para el código actual.

Dev Flow guarda esas decisiones junto con la tarea. El Agent sigue leyendo y modificando código y
ejecutando comandos; ampliar el alcance, probar más, repetir y finalizar pasan a ser decisiones visibles.

## Qué cambia con Dev Flow

| Agent directo | Con Dev Flow |
| --- | --- |
| Los límites de archivos viven solo en el prompt | Se registran los archivos previstos y una escritura compatible fuera del plan espera tu decisión |
| “Solo pruebas dirigidas” puede crecer sin límite | Las comprobaciones automáticas tienen tope y la suite completa necesita permiso previo |
| El mismo fallo provoca otra corrección parecida | La tercera repetición exacta se detiene y pide otro enfoque o aprobación |
| Tras reiniciar se reconstruye el progreso desde el chat | Continúan la misma tarea, sus límites y las comprobaciones pendientes |
| Un resultado verde sobrevive a cambios posteriores | Los resultados que ya no corresponden se descartan antes de entregar |

## Las diferencias más importantes

### La tarea no crece en silencio

Cada trabajo guarda los archivos previstos y las comprobaciones necesarias. Las herramientas compatibles
se detienen antes de escribir fuera del plan; puedes permitir una vez, revisar el plan o rechazar. Antes de
probar y terminar se vuelven a comparar las rutas realmente modificadas.

### Reintentar debe aportar información

Dev Flow compara los tres últimos intentos y solo se detiene ante el mismo fallo, resultado o patrón de
rutas y fallo repetido exactamente. Si cambian la petición, el plan o la implementación, las pruebas y
revisiones antiguas dejan de ser válidas.

### Continuar sin adivinar ni repetir a ciegas

La solicitud, el plan, el avance, las comprobaciones y los motivos de pausa se guardan localmente. Otra
sesión continúa la misma tarea. Si una operación queda incierta, primero se lee lo guardado y el estado
actual del repository antes de decidir un reintento.

### El desarrollador decide cuándo termina

Pasar las pruebas no basta. Antes de entregar, el desarrollador revisa cambios, complejidad innecesaria y
riesgos de mantenimiento, y confirma expresamente que puede explicar y mantener el resultado.

### Ver toda la tarea en local

El código fuente actual incluye un Control Center local para tareas de Codex y DeepSeek, progreso, rutas
previstas y reales, historial de pruebas, pausas por repetición y próximas decisiones. No es un panel en la nube.

## Inicio rápido

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

```text
$dev-flow-codex:dev-flow Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
/dev-flow Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
```

## Cuándo encaja

Encaja en trabajo real de repository que cruza sesiones, necesita límites de archivos o pruebas, puede
requerir retrabajo o una entrega clara. Para preguntas puntuales, explicaciones, consultas de estado y
cambios mecánicos pequeños, usar el Agent directamente suele ser más sencillo.

## Alcance realmente disponible

### npm `@latest` estable

| Producto | Entorno verificado |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Los registros estables cubren instalación, disponibilidad, eliminación, desinstalación y repository
objetivo sin cambios. La Journey estable de DeepSeek también cubre activación, reinicio, finalización y reapertura.

### Código fuente y registros públicos actuales

- El código incluye WebUI local, decisiones de alcance de archivos, freno automático y `darwin-arm64`/`win32-x64`.
- Windows es hoy capacidad de fuente: hay registros nativos de Windows 11, pero no Journey estable.
- [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) documenta una Journey real de Codex con reinicio, refactorización, nuevas pruebas, revisión, entrega y finalización.

### Aún no demostrado o estable

- Menor coste de pruebas, defectos o mantenimiento no está demostrado externamente; la adopción prolongada es limitada.
- Linux, Windows Server, Windows 32-bit/ARM64, Intel Mac, Rosetta y remote MCP no tienen soporte estable.
- Vistas de equipo, sincronización cloud, exportación de Task y traspaso explícito entre Hosts son trabajo futuro.

## Límites y documentación

- Core observa Git en solo lectura y no ejecuta commit, push, merge, rebase, tag ni publish.
- La comprobación previa cubre solo herramientas estructuradas indicadas; no es un sandbox de shell o archivos.
- WebUI es local, loopback y de un solo usuario.
- [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md) · [Architecture](docs/ARCHITECTURE_en.md) · [Commands](docs/COMMANDS_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md)

## Licencia

[Apache License 2.0](LICENSE)
