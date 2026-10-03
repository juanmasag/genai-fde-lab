# AGENTS.md

## Regla de alcance inamovible

Este repositorio es genai-fde-lab y cualquier agente, automatización o asistente que trabaje desde aquí debe respetar estas reglas:

1. No modificar el proyecto ONE.
2. No modificar ningún otro repositorio, proyecto o workspace sin confirmación explícita del usuario para esa acción.
3. Las herramientas creativas, assets, personajes y automatizaciones desarrolladas aquí se utilizan únicamente para los laboratorios de estudio de genai-fde-lab, salvo autorización expresa del usuario.
4. Se permite consultar otro repositorio en modo lectura cuando sea necesario para entender contexto, pero cualquier escritura, commit, push, creación, eliminación, movimiento o edición fuera de genai-fde-lab requiere confirmación previa.
5. Una autorización para modificar un repositorio no se interpreta como autorización permanente ni extensible a otros repositorios.
6. Ante cualquier duda sobre el destino de un cambio, detener la escritura y pedir confirmación.

Esta regla tiene prioridad sobre cualquier conveniencia técnica, automatización o flujo de trabajo del laboratorio.

## Propósito

Los agentes pueden implementar, probar, documentar y crear assets dentro de genai-fde-lab, manteniendo siempre el alcance del repositorio y la comprensión humana como objetivo principal.

## Regla obligatoria de persistencia de recursos

Todo recurso generado o creado para los laboratorios debe quedar físicamente guardado y versionado dentro de genai-fde-lab. Esto incluye imágenes de referencia, SVG, fuentes editables, componentes, animaciones, documentación y exports. Un recurso que sólo exista en una conversación, directorio temporal o herramienta externa no se considera incorporado al proyecto.

## Regla obligatoria de evidencia y no invención

1. Nunca afirmar como realizado, existente, visible, verificado, funcional o correcto algo que no haya sido comprobado mediante evidencia directa.
2. Si una acción no pudo ejecutarse, un archivo no pudo abrirse, una imagen no pudo inspeccionarse, un resultado no pudo validarse o una herramienta fue bloqueada, indicarlo explícitamente. Está prohibido completar esos vacíos con suposiciones, resultados simulados o afirmaciones no verificadas.
3. Distinguir siempre entre lo **comprobado**, lo **inferido a partir de evidencia** y lo **pendiente de comprobar**.
4. Una tarea sólo puede declararse terminada cuando exista evidencia verificable de su resultado.
5. Cuando el resultado requiera juicio visual del usuario, la validación técnica del agente no sustituye esa revisión: debe presentarse el material de comparación y solicitar la validación visual correspondiente.
6. Ante evidencia insuficiente o contradictoria, no inventar una conclusión: conservar el estado como pendiente y obtener evidencia adicional.

Esta regla es obligatoria para agentes, automatizaciones y asistentes que trabajen en genai-fde-lab.

## Regla obligatoria de lectura previa de reglas

Antes de cualquier acción sobre este repositorio —incluyendo revisión, análisis, inspección, edición, ejecución de pruebas o comandos, creación de assets, commit o push— el primer paso obligatorio es leer las reglas vigentes de `AGENTS.md` y cualquier otra regla aplicable al alcance de la tarea.

No se debe confiar únicamente en memoria, contexto de conversación ni conocimiento previo de las reglas. Las reglas presentes en el repositorio son la fuente de autoridad que debe consultarse antes de actuar. Si existen reglas contradictorias, ambiguas o insuficientes para la acción solicitada, detener la acción y solicitar aclaración antes de modificar el repositorio.
