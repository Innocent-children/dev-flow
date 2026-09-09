<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Icono de Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Conserva el alcance, los límites de verificación y el progreso de las tareas largas de programación con IA entre sesiones.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Evita que las tareas largas se desvíen

Cuanto más dura una tarea de programación, más fácil es que cambie poco a poco: aparecen más archivos,
una comprobación dirigida se convierte en una ejecución de pruebas sin límite, el mismo fallo provoca
otro intento parecido o una sesión reiniciada tiene que reconstruir el avance desde el chat.

Dev Flow guarda en una sola tarea local la petición acordada, las rutas previstas, el plan de
verificación creado tras el análisis, la etapa actual y los resultados. Codex o DeepSeek sigue encargándose de modificar el código.

Cada solicitud nueva se evalúa en modo de solo lectura antes de elegir Dev Flow. Después, el Host pregunta
si se usará una rama local o remota, la rama inicial y el nombre de la nueva rama de tarea. Para una fuente
local también pregunta si se copiarán los cambios preparados, los no preparados y los archivos sin seguimiento
que Git no ignora, conservando el directorio de origen y el estado del índice. La creación local no requiere
red; solo la remota ejecuta fetch. Los conflictos detienen la creación del Task y conservan el destino para revisarlo.

La búsqueda de repositorios y el uso del índice de código siguen las instrucciones actuales del usuario
y el `AGENTS.md` aplicable. Si estas instrucciones requieren un índice de proyectos, el Host examina
los repositorios candidatos en modo de solo lectura antes de la confirmación y fija el alcance confirmado
en la Task. Estas instrucciones tienen prioridad sobre la preferencia del plugin para el índice de código.

- **El alcance permanece claro.** Registra las rutas previstas, pide confirmación antes de que las
  herramientas estructuradas compatibles escriban fuera del plan y vuelve a comprobar los cambios reales
  antes de las pruebas y la entrega.
- **Cada worktree tiene un solo propietario de cambios.** Core calcula los cambios actuales de la Task
  desde Git; los commits lineales normales continúan, mientras que una reescritura de rama o la sustitución
  del worktree detiene la tarea.
- **La verificación se ajusta a la tarea.** TASKS guarda comprobaciones, motivos, esfuerzo inicial y
  expectativas de suite completa/código de prueba. Solo un impacto, riesgo, fallo o vacío concreto amplía el presupuesto.
- **La revisión termina en el cambio actual.** Tras modificar, revisa el diff, el impacto causal y la
  aceptación; una corrección solo repite comprobaciones relacionadas y un code review explícito es de solo lectura.
- **El trabajo continúa después de un reinicio.** Una nueva sesión recupera la misma tarea, las
  comprobaciones pendientes y la decisión actual sin reconstruirlas desde la conversación.
- **Solo se reutilizan resultados vigentes.** Los cambios en la petición, el plan, la implementación o
  el repositorio invalidan las comprobaciones antiguas; el desarrollador revisa el resultado antes de entregarlo.
- **Finalización y recuperación comprobables.** Core exige completar todos los elementos del plan y vincular cada criterio de aceptación con comprobaciones vigentes. Tras una interrupción, WebUI recupera los envíos guardados en Core.

## Preparación de archivos

Antes de enviar, Codex ejecuta `dev-flow-codex artifacts collect` y `dev-flow-codex artifacts prepare`. Core enumera todos los cambios de la Action actual; Codex clasifica cada archivo y el comando genera las listas de artefactos. Las omisiones reciben rutas exactas e instrucciones de corrección limitada. Se mantienen las comprobaciones del árbol de trabajo, el historial y los permisos del nodo. Consulte [recopilación y envío de archivos](docs/ARTIFACTS_en.md).

Antes de iniciar Codex, establece `DEV_FLOW_DATA_DIR` con la ruta absoluta canónica de un directorio existente. El servidor MCP, el hook y los comandos de preparación de archivos usan el mismo directorio. `dev-flow-codex artifacts <collect|prepare> --help` devuelve ejemplos JSON, descripciones de campos, salidas y el siguiente paso sin iniciar Core.

## Inicio rápido

> La versión estable publicada en npm bajo `@latest` está verificada actualmente en macOS arm64. Instala primero Node.js `>=24`
> y una versión compatible de Codex o DeepSeek Harness. Consulta las versiones exactas y otros entornos
> en la [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Instala Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

El menú de ciclo de vida muestra el estado de los Adapters y permite volver, salir, corregir entradas y abrir Control Center. Antes de confirmar, muestra las versiones y las rutas afectadas. `install`, `repair` y `reinstall` conservan por defecto la versión instalada; `upgrade` elige `latest`. Repetir una instalación o reparación saludable, una actualización ya aplicada o una eliminación completada no produce cambios; `reinstall` vuelve a reemplazar el paquete. `doctor` muestra las comprobaciones fallidas y los comandos para resolverlas. Consulte `dev-flow repair --help`; el modo JSON no hace preguntas. Estos comandos gestionan los Adapters; actualice el lanzador público con `npm install -g @imotong/dev-flow@latest`.

Elige Codex, DeepSeek o ambos en la configuración interactiva. Antes de iniciar la primera tarea,
completa también el último paso que indique el instalador:

- **Codex:** abre `/hooks`, revisa el hook incluido con Dev Flow y márcalo como confiable. La comprobación
  previa compatible de `apply_patch` no funciona hasta que confíes en el hook.
- **DeepSeek Harness:** reinicia el Profile de DSH elegido después de la instalación.

El Adapter del código fuente actual requiere DSH `>=0.1.2-rc.1`; cada operación de Dev Flow comprueba la autorización introducida directamente por el usuario en el turno actual.

### 2. Inicia una tarea

Envía este mensaje de usuario en **Codex**:

```text
$dev-flow-codex:dev-flow Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
```

Codex conserva las decisiones y autorizaciones que siguen siendo válidas, sin pausas adicionales para «confirmar y continuar». Si queda una decisión pendiente o falta información necesaria, formula una pregunta concreta.

O envía este mensaje en **DeepSeek Harness**:

```text
/dev-flow Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
```

Son selectores de conversación, no comandos de shell. Incluye un objetivo concreto, las condiciones de
aceptación, el límite de archivos y el tope de pruebas. La primera respuesta evalúa el impacto y pregunta
si prefieres trabajar directamente o usar Dev Flow; ni siquiera un selector explícito omite esa decisión.
Si eliges Dev Flow, confirma el remote, la base y la rama de destino. Codex abre un worktree administrado
cuando el Host lo permite; DeepSeek muestra cómo reiniciar desde el nuevo worktree porque el Workspace Root
de la sesión es fijo.

Antes de iniciar una nueva sesión de Codex, la sesión de origen guarda la discusión original pertinente y un documento estructurado, separando los requisitos confirmados de las sugerencias no aceptadas y las preguntas pendientes. La creación de tareas de escritorio y el reinicio mediante CLI usan el mismo material guardado; el contenido largo se entrega en archivos completos, sin recortes. Consulte la [arquitectura](docs/ARCHITECTURE_en.md#codex-requirements-handoff).

El documento conserva las instrucciones y autorizaciones específicas de la sesión; Codex carga normalmente los archivos `AGENTS.md` globales y del repositorio que correspondan, sin duplicar su contenido en el traspaso. Los complementos necesarios para reglas que la sesión de destino no pueda detectar indican su origen y ámbito de aplicación.

### 3. Retoma y revisa el progreso

Después de reiniciar la sesión, solicita explícitamente continuar la Task en su worktree original.
El sistema comprueba ese worktree y continúa desde el estado guardado, sin volver a evaluar la
petición ni pedirte que elijas Dev Flow otra vez. Si el worktree original desapareció o fue
reemplazado, la Task se pausa hasta que lo restaures o abandones explícitamente la tarea (abandon).
El sistema no cambia a otro worktree.

```bash
# Consultar las integraciones instaladas
dev-flow status --host all

# Abrir la vista local de tareas
dev-flow webui start
```

Para instalación no interactiva, Profiles de DSH personalizados, actualizaciones, reparación y
eliminación, consulta la [Command Reference](docs/COMMANDS_en.md).

## Cuándo resulta útil

Dev Flow resulta útil para trabajo de repositorio que abarca varias sesiones, necesita un límite real
de archivos, restringe el esfuerzo de pruebas o puede requerir retrabajo sin reutilizar resultados obsoletos.

Para preguntas puntuales, explicaciones de código, consultas de estado y pequeños cambios mecánicos que
no necesitan guardar el progreso, suele ser más sencillo usar Codex o DeepSeek directamente.

## Mascota de escritorio (macOS arm64)

El paquete local conserva la apariencia predeterminada. La Chica Ballena y otras apariencias personalizadas se importan como paquetes de recursos independientes; las actualizaciones de la aplicación conservan los recursos importados.

La mascota está disponible en macOS arm64 mediante un paquete local de desarrollo que incluye `DevFlowPet.app`; las listas habituales de archivos npm y la preparación de versiones oficiales omiten la aplicación nativa. Ejecutar un paquete ya compilado no requiere Swift/Xcode y utiliza el Core de un Adapter Codex o DeepSeek configurado. Muestra el estado guardado de una Task y abre su WebUI, sin inferir actividad en vivo del Host ni porcentajes de progreso. Al salir se conservan las Tasks y la WebUI.

Puedes importar un PNG o SVG estático, un paquete de animación nativo PNG/SVG o un atlas Codex de formato 1/2. Los paquetes nativos requieren cinco animaciones de tarea y admiten cuatro adicionales; los atlas Codex extraen nueve animaciones y 57 fotogramas. Para usar la extensión de alta resolución de Dev Flow en Codex, prepara también un atlas de dimensiones estándar. El material disponible determina los paseos, saludos y gestos de pensamiento en reposo, con un control independiente y prioridad para los avisos de tareas. Actualizar el programa y volver a importar el material son operaciones separadas.

La barra de menús muestra el logotipo curvo de Dev Flow en un solo color, que se adapta a la apariencia del sistema. El tamaño de la mascota ofrece seis ajustes del 50% al 200%, sin cambiar el texto del globo. La apariencia predeterminada se incluye en un paquete separado con nueve animaciones y 312 fotogramas SVG.

Mientras no haya una tarea seleccionada, la mascota sigue buscando tareas nuevas: primero elige la tarea bloqueada actualizada más recientemente y, si no hay ninguna, la tarea activa actualizada más recientemente. Mantiene la selección hasta que la cambies manualmente.

Consulta la [guía de la mascota](docs/DESKTOP-PETS_en.md) para obtener la aplicación, instalarla, actualizarla, conocer las reglas y los límites, y resolver problemas. La matriz de soporte define el soporte público.

```bash
dev-flow pet start
dev-flow pet stop
```

## Documentación

- **Uso:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Proyecto:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Licencia

[Apache License 2.0](LICENSE)

## Adaptación para Windows de escritorio

Windows 10/11 x64 está destinado a equipos de escritorio convencionales con procesadores Intel o AMD de 64 bits. Las reglas de rutas, permisos, comandos y limpieza del Host se separan en `platform/windows/` y `platform/macos/`; Core comparte la semántica de tareas independiente de la plataforma. Los lanzadores de comandos de Windows usan UTF-8 y la observación de Git de Core oculta las ventanas de consola. Consulte el [informe de adaptación](docs/WINDOWS-ADAPTATION_en.md) para conocer la verificación nativa en Windows y sus límites; estos resultados no amplían el soporte de los paquetes estables.

Windows también ofrece la mascota de escritorio: selección de tareas y estado, menú de bandeja, apariencias PNG/SVG, animaciones nativas, atlas Codex PNG/WebP, nueve acciones, arrastre, seis tamaños, ocultar/restaurar e inicio/parada independientes. Compile el paquete local de Windows con `node scripts/build-desktop-pet-windows.mjs --output "C:\pet-build"`; consulte los requisitos y la instalación en la [guía de la mascota](docs/DESKTOP-PETS_en.md). Las implementaciones de Windows y macOS permanecen separadas.
En Windows, cambiar el tamaño finaliza la actividad de reposo actual y reanuda su programación normal.

En Windows, los directorios AppData existentes se resuelven a sus rutas reales, incluidos los alias de los hosts de escritorio empaquetados; los enlaces simbólicos siguen rechazándose.

La distribución de desarrollo para Windows incluye ambos paquetes Adapter y la aplicación de escritorio. Tras instalar el lanzador, use `dev-flow install --host all --yes` y `dev-flow pet start`. La reparación y reinstalación usan la misma entrada, verifican los hashes, actualizan la aplicación y conservan los datos de Task, ajustes y apariencias.

`dev-flow-codex host-launch <operation>` lee un objeto JSON UTF-8 de hasta 1 MiB del flujo stdin y admite entradas divididas en bloques y caracteres multibyte repartidos entre bloques. Los errores de lectura, UTF-8 inválido, miembros duplicados, JSON inválido, arrays y null se rechazan antes de ejecutar la operación. Los errores se escriben en stderr y los resultados JSON correctos en stdout.

## Ayuda de comandos y recuperación de tareas

La ayuda de Codex describe los parámetros de las operaciones del árbol de trabajo, los campos de respuesta y el siguiente paso. Una vez preparados todos los repositorios, el Host reúne el alcance guardado de los árboles de trabajo. Los Schemas de respuesta de MCP indican dónde leer Task y Action; las sesiones reanudadas resuelven primero los envíos pendientes.

```bash
dev-flow-codex --help
dev-flow-codex host-launch prepare --help
dev-flow-codex artifacts --help
dev-flow-codex artifacts collect --help
dev-flow-codex artifacts prepare --help
```

Consulta los parámetros y las reglas de recuperación en la [referencia de comandos](docs/COMMANDS_en.md).

`host-launch prepare` genera `launch_id` cuando se omite y usa ese ID para comprobar el registro de inicio. Para reintentar el mismo inicio, envíe el `receipt.launch_id` devuelto; si el registro ya está en `prepared`, se omite fetch. Un ID explícito debe coincidir con el registro guardado.

`host-launch dispatch-result` acepta la respuesta completa de creación de Codex, incluido el JSON de `content[].text`. Guarda `clientThreadId` como `host_client_thread_id` con la fase `queued`; reenviar un resultado conservado con los mismos `launch_id` y `repository_key` permite recuperar un registro `uncertain`. Las comprobaciones posteriores siguen la misma creación, sin volver a despacharla.

Codex conserva las solicitudes completas de creación de espacios de trabajo para volver a leerlas. `dispatch-start` prepara, `dispatch-call` permite una llamada, `dispatch-recover` reanuda una operación cuya llamada no se realizó y `dispatch-reconcile` identifica una tarea existente cuando el resultado es desconocido. El llamador analiza archivos JSON completos; la falta de resultados no autoriza una creación duplicada.
