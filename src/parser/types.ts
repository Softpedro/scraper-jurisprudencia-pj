/**
 * Tipos de dominio: la información que extraemos de cada resolución.
 */

/** Una resolución (cada tarjeta de resultado en la página). */
export interface Documento {
  /** Número de expediente (ej. "020788-2024"). */
  nroExpediente: string;
  /** Tipo de recurso (ej. "Casación"). */
  recurso: string;
  /** Pretensión / Delito. */
  pretension: string;
  /** Tipo de resolución (ej. "Ejecutoria Suprema"). */
  tipoResolucion: string;
  /** Fecha de la resolución (dd/mm/aaaa). */
  fechaResolucion: string;
  /** Sala Suprema. */
  sala: string;
  /** Norma de Derecho Interno (puede venir vacío). */
  normaDI: string;
  /** Sumilla / resumen. */
  sumilla: string;
  /** Palabras clave. */
  palabrasClave: string;
  /** UUID de la resolución; sirve para descargar el PDF vía ServletDescarga. */
  uuid: string | null;
  /** Nombre del archivo PDF ya descargado. `null` mientras no se haya descargado. */
  pdfFile: string | null;
}

/** Información de paginación leída de la página de resultados. */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
}
