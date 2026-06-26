/**
 * Tests del parser de resultados del PJ, contra un fixture con la estructura
 * real de dos resoluciones (una completa y otra sin sumilla/palabras).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";

import { parseResults, parsePagination } from "../src/parser/results";

const HTML = fs.readFileSync(
  path.join(__dirname, "fixtures", "resultado-sample.html"),
  "utf8"
);

test("parsea las dos resoluciones del fixture", () => {
  const docs = parseResults(HTML);
  assert.equal(docs.length, 2);
});

test("extrae todos los campos de una resolución completa", () => {
  const d = parseResults(HTML)[0];
  assert.equal(d.recurso, "Casación");
  assert.equal(d.nroExpediente, "020788-2024");
  assert.equal(d.pretension, "Pago de Beneficios Sociales,Desnaturalización de Contrato");
  assert.equal(d.tipoResolucion, "Ejecutoria Suprema");
  assert.equal(d.fechaResolucion, "01/06/2026");
  assert.equal(d.sala, "Segunda Sala de Derecho Constitucional y Social Transitoria");
  assert.equal(d.normaDI, "");
  assert.equal(d.uuid, "ed05892f-6952-4c79-ac3d-8c4614818d59");
  assert.equal(d.pdfFile, null);
});

test("quita el prefijo 'Sumilla:' duplicado del valor", () => {
  const d = parseResults(HTML)[0];
  assert.ok(d.sumilla.startsWith("En consecuencia"), `sumilla: ${d.sumilla}`);
  assert.equal(d.palabrasClave, "PROCESO ORDINARIO NLPT,Contrato de intermediación laboral");
});

test("una resolución sin sumilla/palabras deja esos campos vacíos", () => {
  const d = parseResults(HTML)[1];
  assert.equal(d.recurso, "Apelación");
  assert.equal(d.nroExpediente, "027929-2025");
  assert.equal(d.sumilla, "");
  assert.equal(d.palabrasClave, "");
  assert.equal(d.uuid, "87870594-c568-4529-bfab-b262dc92a684");
});

test("parsePagination lee total de registros, páginas y página actual", () => {
  const p = parsePagination(HTML);
  assert.equal(p.totalRecords, 17667);
  assert.equal(p.totalPages, 1767); // del maxValue del spinner
  assert.equal(p.currentPage, 2);
});

test("parsePagination sin datos asume una sola página", () => {
  const p = parsePagination("<html><body>sin resultados</body></html>");
  assert.equal(p.totalPages, 1);
  assert.equal(p.totalRecords, 0);
});
