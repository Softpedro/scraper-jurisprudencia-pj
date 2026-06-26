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
npm run scrape        # recorre resultados + descarga PDFs
npm run retry         # reintenta descargas fallidas
npm test              # tests unitarios
```

> Estado: **en desarrollo** — reutilizando el motor JSF de un scraper previo (OEFA, mismo stack)
> y adaptando la capa de búsqueda/paginación/descarga a RichFaces del PJ. Ver `docs/recon-pj.md`.

## Licencia

MIT
