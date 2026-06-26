/**
 * Paginación de resultados.
 *
 * En la página de resultados, el número de página se cambia con un `spinner`
 * (campo de texto) y el botón "IR" (submit), que reenvía el formulario completo.
 * El spinner acepta un número de página absoluto, así que se puede saltar
 * directo a cualquier página (clave para reanudar).
 */
import { AxiosInstance } from "axios";
import * as cheerio from "cheerio";

import { SEARCH_PAGE_URL } from "../config";
import { collectFormFields, submitForm } from "../http/postback";

/**
 * Solicita una página concreta a partir del HTML de resultados actual (del que
 * se toma el ViewState vigente y los ids del paginador) y devuelve el HTML de
 * la página pedida.
 */
export async function fetchPage(
  http: AxiosInstance,
  currentHtml: string,
  page: number
): Promise<string> {
  const $ = cheerio.load(currentHtml);

  const viewState = $('input[name="javax.faces.ViewState"]').attr("value");
  if (!viewState) {
    throw new Error("No se encontró el ViewState en la página de resultados.");
  }

  // Botón "IR" (submit con value=IR) y el campo del spinner de página.
  let irName: string | null = null;
  $('#formBuscador input[type="submit"]').each((_, el) => {
    if (!irName && ($(el).attr("value") ?? "").trim() === "IR") {
      irName = $(el).attr("name") ?? null;
    }
  });

  let spinnerName: string | null = null;
  $("#formBuscador input.rf-insp-inp").each((_, el) => {
    if (!spinnerName) spinnerName = $(el).attr("name") ?? null;
  });

  if (!irName || !spinnerName) {
    throw new Error("No se encontró el paginador (botón IR / spinner).");
  }

  const payload = collectFormFields($, "#formBuscador");
  payload[spinnerName] = String(page);
  payload[irName] = "IR";
  payload["javax.faces.ViewState"] = viewState;

  const { html } = await submitForm(http, SEARCH_PAGE_URL, payload);
  return html;
}
