# Scraper Jurisprudencia — Poder Judicial del Perú (TypeScript)

Scraper en **TypeScript** para el buscador de **Jurisprudencia del Poder Judicial**: recorre
los resultados paginados, extrae los datos de cada resolución y descarga los PDFs, manejando el
_rate limiting_ (**429**) con reintentos y backoff exponencial.

> **Sitio objetivo:** https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/resultado.xhtml
>
> Hecho **solo con peticiones HTTP + parseo** (axios + cheerio). **Sin automatización de
> navegador**. El sitio es **JSF + RichFaces**: requiere mantener sesión (`JSESSIONID`),
> reenviar el `ViewState` en cada POST y parsear respuestas AJAX (`<partial-response>`). El
> proceso de ingeniería inversa está en [`docs/recon-pj.md`](docs/recon-pj.md).

## Requisitos

- **Node.js >= 18** (probado con v22)
- npm

## Instalación

```bash
npm install
```

## Uso

```bash
npm run scrape              # busca, recorre resultados y descarga PDFs
npm run retry               # reintenta las descargas de output/failed.json
npm test                    # tests unitarios
npm run scrape -- --help    # ayuda del CLI (uso, variables, salida)
```

### Variables de entorno

| Variable        | Default                | Para qué sirve |
|-----------------|------------------------|----------------|
| `SEARCH_TERM`   | `contrato de trabajo`  | Texto a buscar en el contenido de las resoluciones. |
| `MAX_PAGES`     | `3`                    | Límite de páginas. **`0` = todas**. El default bajo es para pruebas. |
| `DOWNLOAD_PDFS` | activado               | `0` para no descargar PDFs (solo extraer datos). |
| `REQUEST_DELAY_MS` | `1000`              | Delay entre peticiones. |
| `RETRY_MAX`     | `5`                    | Reintentos ante 429 / 5xx / red. |

```bash
# Todas las páginas de un término, con PDFs
SEARCH_TERM="despido arbitrario" MAX_PAGES=0 npm run scrape
```

## Qué genera

```
output/
  data.json        ← resoluciones extraídas (acumulado, deduplicado por uuid)
  checkpoint.json   ← última página completada (para reanudar)
  failed.json       ← descargas que fallaron tras los reintentos
pdfs/
  Resolucion_..._....pdf   ← nombre tomado del header Content-Disposition
```

Cada resolución incluye: recurso, N° de expediente, pretensión/delito, tipo de
resolución, fecha, sala suprema, norma de derecho interno, sumilla, palabras
clave, `uuid` y el archivo PDF descargado.

## Reanudable y tolerante a fallos

- **Checkpoint**: cada página se guarda al instante; si el proceso se corta,
  retoma desde la página siguiente (el paginador acepta un número absoluto).
- **Descargas idempotentes**: no re-descarga un PDF ya presente en disco.
- **Manejo de 429**: cada descarga se envuelve en backoff exponencial (con
  `Retry-After`); lo que no se logra queda en `failed.json` para `npm run retry`.

## Tests

Tests unitarios con el runner nativo de Node (`node:test`), sin dependencias extra:

```bash
npm test
```

- `parser/results` — extrae los campos de cada resolución contra un fixture con la
  estructura real (incluye una resolución sin sumilla) y lee la paginación.
- `util/backoff` — reintenta ante 429/5xx/red, se rinde ante errores no recuperables
  y respeta el tope de reintentos.

## Nota sobre el desarrollo

El motor JSF (sesión, ViewState, paginación, descarga, backoff de 429, checkpoint) se
desarrolló y probó primero contra el sitio de pruebas que sugiere el reto
([OEFA](https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml), sin VPN) y luego
se adaptó al Poder Judicial. Ambos son **JSF**, pero el PJ usa **RichFaces** con un flujo
de _full postback_ (HTML completo) y descarga directa por `ServletDescarga`.

## Licencia

MIT
