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

Cada petición nueva se evalúa en modo de solo lectura antes de elegir Dev Flow. Si lo eliges, confirmas
el remote, la rama base y una rama nueva para la tarea; el Host crea desde esa base remota un worktree
dedicado y limpio antes de que Core cree la Task. Los cambios del checkout de origen no se copian.

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

## Inicio rápido

> La versión estable publicada en npm bajo `@latest` está verificada actualmente en macOS arm64. Instala primero Node.js `>=24`
> y una versión compatible de Codex o DeepSeek Harness. Consulta las versiones exactas y otros entornos
> en la [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Instala Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Elige Codex, DeepSeek o ambos en la configuración interactiva. Antes de iniciar la primera tarea,
completa también el último paso que indique el instalador:

- **Codex:** abre `/hooks`, revisa el hook incluido con Dev Flow y márcalo como confiable. La comprobación
  previa compatible de `apply_patch` no funciona hasta que confíes en el hook.
- **DeepSeek Harness:** reinicia el Profile de DSH elegido después de la instalación.

### 2. Inicia una tarea

Envía este mensaje de usuario en **Codex**:

```text
$dev-flow-codex:dev-flow Añade un límite de frecuencia para los inicios de sesión fallidos. Modifica solo archivos de autenticación y ejecuta como máximo 4 comprobaciones dirigidas.
```

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
