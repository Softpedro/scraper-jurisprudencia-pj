# Recon — Jurisprudencia del Poder Judicial

Objetivo: https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/resultado.xhtml

## 1. Tecnología del sitio

- **JSF (Mojarra) + RichFaces 4.2.2**. jQuery 1.11.3 + Bootstrap.
- El `GET` inicial entrega `JSESSIONID` (cookie) y un `javax.faces.ViewState`
  **corto** (token `nnn:mmm`) → *server-side state saving*: hay que reusar siempre
  el último ViewState recibido.
- Detalle clave: la búsqueda y la paginación son **full postback** del formulario
  `formBuscador` que devuelven **HTML completo** (no el AJAX binario de RichFaces).
  Por eso se parsea directo con cheerio, sin tocar las respuestas AJAX.

## 2. Flujo completo (validado)

```
GET  inicio.xhtml                  → sesión + ViewState + form de búsqueda GENERAL
POST inicio.xhtml (lupa GENERAL)   → 302 → resultado.xhtml (página 1 de resultados)
POST resultado.xhtml (spinner+IR)  → 302 → resultado.xhtml (página N)
GET  ServletDescarga?uuid=...       → PDF (application/octet-stream)
```

> El 302 redirige a `http://`; hay que forzar `https://` al seguirlo.

## 3. Búsqueda GENERAL  ✅

En `inicio.xhtml`, el campo es `formBuscador:txtBusqueda` y la lupa es un
`input[type=image]` cuyo `mojarra.jsfcljs` añade parámetros extra:

```
forward=buscar
busqueda=especializada
formBuscador:j_idtNN=...         (el botón)
formBuscador:j_idtNN=21          (orden = Fecha Resolución)
formBuscador:j_idtNN=DESC        (forma)
formBuscador:j_idtNN=Principal   (pestaña)
formBuscador:j_idtNN=1
```

El scraper descubre el botón dinámicamente (el `input[type=image]` cuyo mojarra
tiene `forward=buscar` y `Principal`), serializa **todos** los campos del form,
fija `txtBusqueda` y hace el POST. Búsqueda de prueba: "contrato de trabajo" →
**17 667 resultados, 1 767 páginas** (10 por página).

## 4. Paginación  ✅

En la página de resultados hay un `spinner` (campo de texto con el número de
página) y un botón **IR** (`input[type=submit]`). Se reenvía el formulario con
`spinner = N` + el botón IR. El número de página es **absoluto** → se salta
directo a cualquier página (clave para reanudar). El máximo de páginas viene en
el script del spinner (`maxValue: 1767`).

## 5. Descarga del PDF  ✅

Cada resolución trae un enlace **directo**:

```html
<a href="/jurisprudenciaweb/ServletDescarga?uuid=ed05892f-6952-4c79-ac3d-8c4614818d59">
```

`GET` a esa URL → `application/octet-stream` con
`Content-Disposition: attachment;filename=Resolucion_..._....pdf`. **No requiere
postback** (más simple que OEFA). El nombre del archivo se toma del header.

## 6. Datos extraídos por resolución

Del panel `div.rf-p` de cada resultado: recurso, N° de expediente, pretensión /
delito, tipo de resolución, fecha, sala suprema, norma de derecho interno,
sumilla, palabras clave y el `uuid`.

## 7. Rate limiting (429)

Manejo en `src/util/backoff.ts`: reintentos con backoff exponencial ante
429/5xx/red, respeto de `Retry-After`, delay entre peticiones y log de fallidos
(`output/failed.json`) reprocesable con `npm run retry`.
