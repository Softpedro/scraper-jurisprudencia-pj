# Recon — Jurisprudencia del Poder Judicial

Objetivo: https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/resultado.xhtml

## 1. Tecnología del sitio

- **JSF (Mojarra) + RichFaces** (a diferencia de PrimeFaces). Confirmado por
  `RichFaces.ajax(...)`, clases `rf-pp-*`, `jsf.util.chain` y los popups RichFaces.
- Carga jQuery 1.11.3 + Bootstrap. El AJAX de RichFaces 4 usa el mecanismo estándar
  de JSF 2 (`<partial-response>`), así que el parser de respuestas parciales se reutiliza.
- El `GET` inicial entrega `JSESSIONID` (cookie + en la URL `;jsessionid=...`) y un
  `javax.faces.ViewState` **corto** (token tipo `-2633..:4614..`) → *server-side state
  saving*: hay que reusar siempre el último ViewState recibido.

## 2. GET inicial  ✅

```
GET /jurisprudenciaweb/faces/page/resultado.xhtml
→ 200, set-cookie: JSESSIONID=...; Path=/jurisprudenciaweb
→ <input name="javax.faces.ViewState" value="...:...">
```

## 3. Formulario de búsqueda  🟡 (pendiente capturar el POST real)

- Form: **`formBuscador`**.
- Campo de texto full-text: **`formBuscador:txtBusqueda`** (maxlength 200;
  "El texto ingresado se buscará en el contenido de las resoluciones").
- Filtros/opciones detectados: `formBuscador:optBaseLegal`, `optResultado`, `optResumen`,
  `optTema` (ámbitos de búsqueda).
- Tabla de resultados: **`formBuscador:panealJur`** (vacía hasta ejecutar una búsqueda).
- El disparo de la búsqueda es **AJAX de RichFaces** y no se ve en el HTML estático:
  hay que capturar el POST real en DevTools.

```
TODO: pegar aquí el cURL + payload + (trozo de) response del POST de búsqueda.
Campos a confirmar: javax.faces.source, javax.faces.partial.execute/render,
el id del botón de buscar, y params propios de RichFaces.
```

## 4. Paginación  🔲 (pendiente)

```
TODO: capturar el POST al cambiar de página (RichFaces dataScroller / similar).
```

## 5. Descarga del PDF  🔲 (pendiente)

```
TODO: capturar el request al abrir/descargar el PDF de una resolución.
Confirmar: GET directo vs POST (mojarra.jsfcljs), Content-Type, Content-Disposition.
```

## 6. Rate limiting (429)

Estrategia heredada del motor (`src/util/backoff.ts`): reintentos con backoff
exponencial ante 429/5xx/red, respeto de `Retry-After`, y log de fallidos.

## Notas de reutilización

Del scraper de OEFA (mismo stack JSF) se reutiliza tal cual: cliente HTTP con sesión,
extracción de ViewState, parseo de `<partial-response>`, backoff, store JSON, checkpoint
y la estructura de tests. Se reescribe la capa específica del sitio: búsqueda, paginación,
descarga y el parser de la tabla de resultados.
