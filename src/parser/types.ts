/**
 * Tipos de dominio: la información que extraemos de cada resolución.
 *
 * PROVISIONAL: los campos finales se ajustan tras el recon de la tabla de
 * resultados del PJ (sumilla, materia, sala, fecha, etc.). Por ahora se mantiene
 * la forma mínima que necesita el store (clave única + archivo del PDF).
 */

/** Una resolución (fila de la tabla de resultados). */
export interface Documento {
  /** Número de orden en la tabla. */
  nro: string;
  /** Número de expediente. */
  expediente: string;
  /** Número de resolución (si aplica). */
  nroResolucion: string;
  /** Sumilla / resumen de la resolución. */
  sumilla: string;
  /** Identificador del PDF (uuid o id que use el sitio). `null` si no hay archivo. */
  pdfUuid: string | null;
  /** Datos extra para construir el request de descarga (se define con el recon). */
  pdfSourceId: string | null;
  /** Nombre del archivo PDF ya descargado. `null` mientras no se haya descargado. */
  pdfFile: string | null;
  /** Índice de la fila dentro de la página. */
  rowIndex: number;
}

/** Información de paginación leída del pie de la tabla. */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
}
