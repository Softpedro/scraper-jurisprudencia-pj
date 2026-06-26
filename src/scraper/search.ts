/**
 * Búsqueda en el Inicio del PJ.
 *
 * El buscador GENERAL vive en `inicio.xhtml`. Al pulsar la lupa se dispara un
 * `mojarra.jsfcljs` que envía el formulario con parámetros extra
 * (`forward=buscar`, `busqueda=especializada`, orden, etc.) y el servidor
 * redirige a `resultado.xhtml` con la primera página de resultados.
 */
import { AxiosInstance } from "axios";
import * as cheerio from "cheerio";

import { INICIO_PAGE_URL } from "../config";
import { collectFormFields, submitForm } from "../http/postback";

export interface SearchParams {
  /** Texto a buscar en el contenido de las resoluciones. */
  term: string;
}

/**
 * Extrae el objeto `{clave:valor}` del `mojarra.jsfcljs(...)` de un onclick.
 * Las comillas vienen escapadas (`\'`), así que primero se quitan los `\`.
 */
function parseMojarraParams(onclick: string): Record<string, string> {
  const clean = onclick.replace(/\\/g, "");
  const match = clean.match(/mojarra\.jsfcljs\([^,]+,\s*\{([^}]*)\}/);
  const params: Record<string, string> = {};
  if (!match) return params;

  const re = /'([^']+)':'([^']*)'/g;
  let p: RegExpExecArray | null;
  while ((p = re.exec(match[1]))) params[p[1]] = p[2];
  return params;
}

/**
 * Ejecuta la búsqueda y devuelve el HTML de la primera página de resultados.
 */
export async function search(
  http: AxiosInstance,
  params: SearchParams
): Promise<string> {
  // 1) GET del Inicio: sesión + ViewState + descubrir el botón GENERAL.
  const getRes = await http.get<string>(INICIO_PAGE_URL);
  const $ = cheerio.load(getRes.data);

  const viewState = $('input[name="javax.faces.ViewState"]').attr("value");
  if (!viewState) {
    throw new Error("No se encontró el ViewState en la página de Inicio.");
  }

  // El botón de la lupa GENERAL es el input[type=image] cuyo mojarra lleva
  // forward=buscar y el tab 'Principal'.
  let buttonParams: Record<string, string> | null = null;
  $('#formBuscador input[type="image"]').each((_, el) => {
    if (buttonParams) return;
    const candidate = parseMojarraParams($(el).attr("onclick") ?? "");
    if (candidate["forward"] === "buscar" && Object.values(candidate).includes("Principal")) {
      buttonParams = candidate;
    }
  });

  if (!buttonParams) {
    throw new Error("No se encontró el botón de búsqueda GENERAL en el Inicio.");
  }

  // 2) Payload: todos los campos del form + término + parámetros del botón.
  const payload = collectFormFields($, "#formBuscador");
  payload["formBuscador:txtBusqueda"] = params.term;
  Object.assign(payload, buttonParams);
  payload["javax.faces.ViewState"] = viewState;

  // 3) POST → (302) → resultado.xhtml.
  const { html } = await submitForm(http, INICIO_PAGE_URL, payload);
  return html;
}
