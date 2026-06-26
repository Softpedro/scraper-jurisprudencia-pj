/**
 * Registro de descargas fallidas.
 *
 * Cuando un PDF no se pudo descargar tras agotar los reintentos, se anota aquí
 * (`output/failed.json`) con el contexto necesario para reintentarlo después con
 * `npm run retry`. Al volver a descargarse con éxito, se elimina del registro.
 */
import * as fs from "fs";
import * as path from "path";

import { OUTPUT_DIR } from "../config";

const FAILED_FILE = path.join(OUTPUT_DIR, "failed.json");

export interface FailedDownload {
  /** UUID de la resolución (clave única). */
  uuid: string;
  nroExpediente: string;
  /** Página donde estaba la resolución (para reubicarla al reintentar). */
  page: number;
  /** Término de búsqueda usado. */
  term: string;
  /** Motivo del fallo (mensaje del último error). */
  reason: string;
  /** Intentos realizados antes de rendirse. */
  attempts: number;
  updatedAt: string;
}

export class FailedLog {
  private items = new Map<string, FailedDownload>();

  /** Carga lo ya registrado (para acumular entre corridas). */
  load(): void {
    try {
      const arr = JSON.parse(
        fs.readFileSync(FAILED_FILE, "utf8")
      ) as FailedDownload[];
      for (const f of arr) this.items.set(f.uuid, f);
    } catch {
      // Aún no existe el archivo: empezamos vacíos.
    }
  }

  /** Anota (o actualiza) un fallo y persiste de inmediato. */
  add(rec: FailedDownload): void {
    this.items.set(rec.uuid, rec);
    this.save();
  }

  /** Quita un fallo (porque se descargó bien) y persiste. */
  remove(uuid: string): void {
    if (this.items.delete(uuid)) this.save();
  }

  has(uuid: string): boolean {
    return this.items.has(uuid);
  }

  all(): FailedDownload[] {
    return [...this.items.values()];
  }

  get size(): number {
    return this.items.size;
  }

  private save(): void {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const arr = [...this.items.values()];
    fs.writeFileSync(FAILED_FILE, JSON.stringify(arr, null, 2), "utf8");
  }
}
