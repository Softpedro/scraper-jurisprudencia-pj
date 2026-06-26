/**
 * Punto de entrada del scraper de Jurisprudencia del Poder Judicial.
 *
 * Flujo normal (`npm start`): búsqueda → recorre todas las páginas (reanudando
 * si corresponde) → por cada página guarda los datos, actualiza el checkpoint y
 * descarga los PDFs (con backoff ante 429). Los fallidos quedan en
 * output/failed.json.
 *
 * Modo reintento (`npm run retry`): reintenta solo las descargas de failed.json.
 *
 * Variables de entorno:
 *   SEARCH_TERM     término de búsqueda (default "contrato de trabajo").
 *   MAX_PAGES       límite de páginas (0 = todas). Default 3 (pruebas).
 *   DOWNLOAD_PDFS   "0" para no descargar PDFs (solo extraer datos). Default sí.
 */
import * as fs from "fs";
import * as path from "path";

import { AxiosInstance } from "axios";

import { createHttpClient } from "./http/client";
import { search } from "./scraper/search";
import { fetchPage } from "./scraper/paginate";
import { parseResults, parsePagination } from "./parser/results";
import { downloadPdf } from "./scraper/downloadPdf";
import { DocumentStore } from "./store/documentStore";
import { FailedLog } from "./store/failedLog";
import {
  readCheckpoint,
  writeCheckpoint,
  clearCheckpoint,
} from "./store/checkpoint";
import { withRetry } from "./util/backoff";
import { sleep } from "./util/sleep";
import { Documento } from "./parser/types";
import {
  SEARCH_TERM,
  PDF_DIR,
  REQUEST_DELAY_MS,
  RETRY_MAX,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
} from "./config";

const MAX_PAGES = Number(process.env.MAX_PAGES ?? 3);
const TERM = SEARCH_TERM;
const DOWNLOAD_PDFS = process.env.DOWNLOAD_PDFS !== "0";
const RETRY_FAILED = process.argv.includes("--retry-failed");

async function main(): Promise<void> {
  const store = new DocumentStore();
  store.load();

  const failed = new FailedLog();
  failed.load();

  // UUIDs ya descargados (con archivo presente en disco): no se vuelven a bajar.
  const downloaded = loadDownloadedSet(store);

  const { http } = createHttpClient();

  if (RETRY_FAILED) {
    await runRetry(http, store, failed, downloaded);
  } else {
    await runScrape(http, store, failed, downloaded);
  }

  console.log(`\n✓ ${store.size} resoluciones en output/data.json`);
  if (DOWNLOAD_PDFS || RETRY_FAILED) {
    console.log(`✓ ${downloaded.size} PDFs en ${PDF_DIR}/`);
    if (failed.size > 0) {
      console.log(
        `⚠️  ${failed.size} descargas pendientes en output/failed.json ` +
          "(reintenta con: npm run retry)"
      );
    }
  }
}

/** Recorrido normal: busca, recorre páginas y descarga PDFs. */
async function runScrape(
  http: AxiosInstance,
  store: DocumentStore,
  failed: FailedLog,
  downloaded: Set<string>
): Promise<void> {
  const checkpoint = readCheckpoint();
  const resumable = checkpoint && checkpoint.term === TERM;
  const startPage = resumable ? checkpoint!.lastCompletedPage + 1 : 1;

  if (resumable) {
    console.log(
      `↻ Reanudando desde la página ${startPage} ` +
        `(checkpoint en ${checkpoint!.lastCompletedPage}/${checkpoint!.totalPages}, ` +
        `${store.size} resoluciones ya guardadas)`
    );
  } else if (checkpoint) {
    console.log("ℹ️  Checkpoint de otra búsqueda; se ignora y se empieza de cero.");
  }

  // Búsqueda: deja la sesión lista y da la primera página + el total.
  console.log(`→ Buscando "${TERM}"…`);
  let html = await search(http, { term: TERM });
  const pagination = parsePagination(html);
  console.log(
    `  ${pagination.totalRecords} resultados · ${pagination.totalPages} páginas ` +
      `(límite: ${MAX_PAGES === 0 ? "todas" : MAX_PAGES}, PDFs: ${DOWNLOAD_PDFS ? "sí" : "no"})\n`
  );

  const lastPage =
    MAX_PAGES === 0
      ? pagination.totalPages
      : Math.min(MAX_PAGES, pagination.totalPages);

  for (let page = startPage; page <= lastPage; page++) {
    // Para páginas > 1 hay que navegar (la página 1 ya la tenemos de la búsqueda).
    if (page > 1) {
      await sleep(REQUEST_DELAY_MS);
      html = await fetchPage(http, html, page);
    }

    const pageDocs = parseResults(html);
    store.add(pageDocs);
    store.save();
    writeCheckpoint({
      lastCompletedPage: page,
      totalPages: pagination.totalPages,
      totalRecords: pagination.totalRecords,
      term: TERM,
      updatedAt: new Date().toISOString(),
    });

    const conPdf = pageDocs.filter((d) => d.uuid).length;
    console.log(
      `  página ${String(page).padStart(3)}/${pagination.totalPages} · ` +
        `+${pageDocs.length} (${conPdf} con PDF) · total ${store.size}/${pagination.totalRecords}`
    );

    if (DOWNLOAD_PDFS) {
      await downloadPagePdfs(http, page, pageDocs, failed, downloaded);
      store.save();
    }
  }

  // Si se completaron todas las páginas, limpiar el checkpoint.
  const finalCp = readCheckpoint();
  if (finalCp && finalCp.lastCompletedPage >= finalCp.totalPages) {
    clearCheckpoint();
    console.log("\n✓ Recorrido completo: checkpoint limpiado.");
  }
}

/** Modo reintento: re-recorre y reintenta solo lo anotado en failed.json. */
async function runRetry(
  http: AxiosInstance,
  store: DocumentStore,
  failed: FailedLog,
  downloaded: Set<string>
): Promise<void> {
  const pending = failed.all();
  if (pending.length === 0) {
    console.log("✓ No hay descargas fallidas pendientes.");
    return;
  }

  const targets = new Set(pending.map((f) => f.uuid));
  const maxPage = Math.max(...pending.map((f) => f.page));
  console.log(
    `↻ Reintentando ${targets.size} descargas fallidas (término "${TERM}", hasta página ${maxPage}).\n`
  );

  let html = await search(http, { term: TERM });

  for (let page = 1; page <= maxPage; page++) {
    if (page > 1) {
      await sleep(REQUEST_DELAY_MS);
      html = await fetchPage(http, html, page);
    }
    const toRetry = parseResults(html).filter(
      (d) => d.uuid && targets.has(d.uuid) && !downloaded.has(d.uuid)
    );
    if (toRetry.length === 0) continue;

    console.log(`  página ${page}: ${toRetry.length} por reintentar`);
    await downloadPagePdfs(http, page, toRetry, failed, downloaded);
    store.add(toRetry);
    store.save();
  }

  console.log(`\n✓ Reintento terminado. Pendientes: ${failed.size}`);
}

/** Descarga (con backoff) los PDFs de una página, anotando los fallidos. */
async function downloadPagePdfs(
  http: AxiosInstance,
  page: number,
  docs: Documento[],
  failed: FailedLog,
  downloaded: Set<string>
): Promise<void> {
  const conPdf = docs.filter((d) => d.uuid);

  for (const doc of conPdf) {
    if (downloaded.has(doc.uuid!)) continue; // ya descargado

    try {
      const result = await withRetry(() => downloadPdf(http, doc), {
        retries: RETRY_MAX,
        baseDelayMs: RETRY_BASE_DELAY_MS,
        maxDelayMs: RETRY_MAX_DELAY_MS,
        onRetry: ({ attempt, delayMs, status }) =>
          console.log(
            `    ⏳ ${doc.nroExpediente}: ${status ?? "red"} — ` +
              `reintento ${attempt}/${RETRY_MAX} en ${Math.round(delayMs / 1000)}s`
          ),
      });

      doc.pdfFile = result.fileName;
      downloaded.add(doc.uuid!);
      failed.remove(doc.uuid!);
      console.log(`    ⬇️  ${result.fileName} (${formatKb(result.bytes)})`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failed.add({
        uuid: doc.uuid!,
        nroExpediente: doc.nroExpediente,
        page,
        term: TERM,
        reason,
        attempts: RETRY_MAX + 1,
        updatedAt: new Date().toISOString(),
      });
      console.log(`    ✗ ${doc.nroExpediente}: ${reason}`);
    }

    await sleep(REQUEST_DELAY_MS); // no saturar el servidor entre descargas
  }
}

/** Reconstruye el set de UUIDs ya descargados (archivo presente en disco). */
function loadDownloadedSet(store: DocumentStore): Set<string> {
  const set = new Set<string>();
  for (const d of store.all()) {
    if (d.uuid && d.pdfFile && fs.existsSync(path.join(PDF_DIR, d.pdfFile))) {
      set.add(d.uuid);
    }
  }
  return set;
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
