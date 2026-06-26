/**
 * Helpers para los POST de formulario (full postback) del sitio del PJ.
 *
 * A diferencia de OEFA (PrimeFaces AJAX), aquí la búsqueda y la paginación son
 * envíos completos del formulario `formBuscador`: el navegador serializa TODOS
 * los campos y el servidor responde con un 302 (POST-redirect-GET) a la página
 * de resultados, que llega como HTML completo. Estos helpers replican eso.
 */
import { AxiosInstance } from "axios";
import type { CheerioAPI } from "cheerio";

import { BASE_URL } from "../config";

export interface PostbackResult {
  /** HTML final de la página de resultados. */
  html: string;
  /** URL efectiva tras seguir el redirect. */
  finalUrl: string;
}

/**
 * Recolecta los campos enviables de un formulario JSF: inputs de texto/hidden
 * con su valor y selects con su opción seleccionada. Omite botones y los
 * checkboxes/radios no marcados (igual que haría el navegador).
 */
export function collectFormFields(
  $: CheerioAPI,
  formSelector = "#formBuscador"
): Record<string, string> {
  const fields: Record<string, string> = {};

  $(`${formSelector} input`).each((_, el) => {
    const name = $(el).attr("name");
    const type = ($(el).attr("type") ?? "text").toLowerCase();
    if (!name) return;
    if (type === "image" || type === "submit" || type === "button") return;
    if ((type === "checkbox" || type === "radio") && $(el).attr("checked") === undefined)
      return;
    fields[name] = $(el).attr("value") ?? "";
  });

  $(`${formSelector} select`).each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const selected = $(el).find("option[selected]").attr("value");
    fields[name] = selected ?? $(el).find("option").first().attr("value") ?? "";
  });

  return fields;
}

/**
 * Envía el formulario y, si el servidor responde con un redirect
 * (POST-redirect-GET), lo sigue manualmente devolviendo el HTML final.
 *
 * El servidor redirige a `http://`; lo forzamos a `https://` para evitar que la
 * conexión sea rechazada.
 */
export async function submitForm(
  http: AxiosInstance,
  actionUrl: string,
  payload: Record<string, string>
): Promise<PostbackResult> {
  const body = new URLSearchParams(payload).toString();

  let res = await http.post<string>(actionUrl, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    maxRedirects: 0,
    validateStatus: (s) => s >= 200 && s < 400,
  });

  let finalUrl = actionUrl;
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers["location"];
    if (!location) throw new Error("Redirect sin cabecera Location tras el POST.");
    finalUrl = normalizeUrl(location);
    res = await http.get<string>(finalUrl, {
      validateStatus: (s) => s >= 200 && s < 400,
    });
  }

  return { html: res.data, finalUrl };
}

/** Resuelve un Location relativo o http hacia una URL absoluta https. */
function normalizeUrl(location: string): string {
  const absolute = location.startsWith("/") ? `${BASE_URL}${location}` : location;
  return absolute.replace(/^http:\/\//i, "https://");
}
