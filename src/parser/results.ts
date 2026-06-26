/**
 * Parseo del HTML de la página de resultados del PJ.
 *
 * Cada resolución es un panel `div.rf-p` que contiene:
 *  - un encabezado (`rf-p-hdr`) con el recurso y el N° de expediente,
 *  - un cuerpo (`rf-p-b`) con pares etiqueta/valor (Sumilla, Sala, etc.),
 *  - un enlace `ServletDescarga?uuid=...` para el PDF.
 */
import * as cheerio from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import { Documento, PaginationInfo } from "./types";

const SERVLET_RE = /ServletDescarga\?uuid=([0-9a-fA-F-]+)/;

/** Mapa de etiqueta visible (normalizada) → campo del documento. */
const LABEL_MAP: Record<string, keyof Documento> = {
  "pretensión/delito": "pretension",
  "tipo resolución": "tipoResolucion",
  "fecha resolución": "fechaResolucion",
  "sala suprema": "sala",
  "norma de derecho interno": "normaDI",
  sumilla: "sumilla",
  "palabras clave": "palabrasClave",
};

/**
 * Extrae todas las resoluciones de una página de resultados.
 */
export function parseResults(html: string): Documento[] {
  const $ = cheerio.load(html);
  const docs: Documento[] = [];

  // Anclamos en el enlace de descarga: cada uno pertenece a una resolución.
  $('a[href*="ServletDescarga?uuid="]').each((_, link) => {
    const panel = $(link).closest("div.rf-p");
    if (!panel.length) return;

    const header = panel.find("div.rf-p-hdr").first();
    const bolds = header.find('span[style*="bold"]');

    const doc: Documento = {
      recurso: cellText($, bolds.eq(0)),
      nroExpediente: cellText($, bolds.eq(1)),
      pretension: "",
      tipoResolucion: "",
      fechaResolucion: "",
      sala: "",
      normaDI: "",
      sumilla: "",
      palabrasClave: "",
      uuid: ($(link).attr("href") ?? "").match(SERVLET_RE)?.[1] ?? null,
      pdfFile: null,
    };

    // Pares etiqueta/valor del cuerpo.
    panel.find("div.rf-p-b .txtbold").each((_, lab) => {
      const label = $(lab)
        .text()
        .replace(/\s+/g, " ")
        .replace(/:\s*$/, "")
        .trim()
        .toLowerCase();
      const key = LABEL_MAP[label];
      if (!key) return;
      const value = cellText($, $(lab).next("div"));
      // `key` proviene de LABEL_MAP, que solo mapea a campos string.
      (doc[key] as string) = value;
    });

    // A veces la sumilla repite el prefijo "Sumilla:".
    doc.sumilla = doc.sumilla.replace(/^sumilla:\s*/i, "");

    docs.push(doc);
  });

  return docs;
}

/**
 * Lee la información de paginación de la página de resultados.
 */
export function parsePagination(html: string): PaginationInfo {
  const totalRecords = Number(
    (html.match(/se obtuvieron\s+([\d.,]+)\s+resultados/i)?.[1] ?? "0").replace(
      /[.,]/g,
      ""
    )
  );
  const currentPage = Number(html.match(/"currentPage":(\d+)/)?.[1] ?? "1");
  // El spinner declara el máximo de páginas (maxValue) — es la fuente más fiable.
  const maxFromSpinner = Number(html.match(/maxValue:\s*(\d+)/)?.[1] ?? "0");
  const perPage = 10;
  const totalPages =
    maxFromSpinner || Math.max(1, Math.ceil(totalRecords / perPage));

  return { currentPage, totalPages, totalRecords };
}

function cellText($: CheerioAPI, el: Cheerio<Element>): string {
  return $(el).text().replace(/\s+/g, " ").trim();
}
