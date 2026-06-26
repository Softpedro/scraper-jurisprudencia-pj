/**
 * Descarga del PDF de una resolución.
 *
 * En el PJ la descarga es un GET directo a `ServletDescarga?uuid=...` que
 * devuelve el binario (`application/octet-stream`) con el nombre en la cabecera
 * `Content-Disposition`. Mucho más simple que el postback de OEFA.
 */
import * as fs from "fs";
import * as path from "path";

import { AxiosInstance } from "axios";

import { PDF_DIR, SERVLET_DESCARGA_URL } from "../config";
import { Documento } from "../parser/types";

export interface DownloadResult {
  fileName: string;
  filePath: string;
  bytes: number;
}

/**
 * Descarga el PDF de `doc` y lo guarda en la carpeta de PDFs.
 *
 * @throws si la resolución no tiene uuid, o si la respuesta no es un PDF
 *   (p. ej. el servidor devolvió una página de error).
 */
export async function downloadPdf(
  http: AxiosInstance,
  doc: Documento
): Promise<DownloadResult> {
  if (!doc.uuid) {
    throw new Error(`La resolución ${doc.nroExpediente} no tiene uuid.`);
  }

  const res = await http.get<ArrayBuffer>(SERVLET_DESCARGA_URL, {
    params: { uuid: doc.uuid },
    responseType: "arraybuffer",
  });

  const buffer = Buffer.from(res.data);
  // Validar que sea un PDF de verdad (empieza con "%PDF").
  if (!buffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
    const contentType = String(res.headers["content-type"] ?? "");
    throw new Error(
      `Respuesta no-PDF para ${doc.nroExpediente} (content-type: ${contentType}).`
    );
  }

  const fileName = sanitizeFileName(
    fileNameFromDisposition(res.headers["content-disposition"]) ??
      fallbackName(doc)
  );

  fs.mkdirSync(PDF_DIR, { recursive: true });
  const filePath = path.join(PDF_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  return { fileName, filePath, bytes: buffer.length };
}

/** Saca el nombre del archivo de la cabecera `Content-Disposition`. */
function fileNameFromDisposition(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const extended = value.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].replace(/^"|"$/g, ""));
    } catch {
      // cae al filename simple
    }
  }

  const simple = value.match(/filename="?([^";]+)"?/i);
  return simple ? simple[1].trim() : null;
}

/** Nombre de respaldo: expediente + recurso (o el uuid). */
function fallbackName(doc: Documento): string {
  const base =
    [doc.nroExpediente, doc.recurso].filter(Boolean).join("_") ||
    doc.uuid ||
    "resolucion";
  return `${base}.pdf`;
}

/** Nombre de archivo seguro: sin separadores ni caracteres inválidos, con .pdf. */
function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[/\\]+/g, "-")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f<>:"|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const safe = cleaned || "resolucion";
  return /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`;
}
