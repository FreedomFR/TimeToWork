import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "fs";
import { registerAndLogin } from "./helpers";

async function addManualEntry(page: Page, description: string, start: string, end: string) {
  await page.getByPlaceholder("Sur quoi avez-vous travaillé ?").fill(description);
  const startInput = page.getByLabel("Heure de début");
  await startInput.click();
  await startInput.fill(start);
  await startInput.blur();
  const endInput = page.getByLabel("Heure de fin");
  await endInput.click();
  await endInput.fill(end);
  await endInput.blur();
  await page.getByRole("button", { name: "AJOUTER" }).click();
  await expect(page.getByText(description)).toBeVisible();
}

async function openExportDialog(page: Page) {
  await page.getByRole("link", { name: "Rapports" }).click();
  await page.getByRole("button", { name: "EXPORTATION" }).click();
  await expect(page.getByRole("dialog", { name: "Exporter le rapport" })).toBeVisible();
}

async function runExport(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter", exact: true }).click(),
  ]);
  const path = await download.path();
  return { filename: download.suggestedFilename(), buffer: readFileSync(path!) };
}

test("opens an export dialog with content, columns and format choices", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Export dialogue", "0800", "0930");
  await openExportDialog(page);

  await expect(page.getByLabel("Détaillé (une ligne par entrée)")).toBeChecked();
  await expect(page.getByLabel("Résumé par projet")).not.toBeChecked();
  await expect(page.getByLabel("CSV")).toBeChecked();
  for (const format of ["Excel (.xlsx)", "PDF", "JSON"]) {
    await expect(page.getByLabel(format)).toBeVisible();
  }
  await expect(page.getByText("COLONNES")).toBeVisible();

  await page.getByLabel("Résumé par projet").check();
  await expect(page.getByText("COLONNES")).not.toBeVisible();

  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("exports the detailed report as CSV with only the chosen columns", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Ligne CSV", "0800", "0930");
  await openExportDialog(page);

  await page.getByLabel("Client").uncheck();
  await page.getByLabel("Balises").uncheck();
  await page.getByLabel("Facturable").uncheck();

  const { filename, buffer } = await runExport(page);
  const csv = buffer.toString("utf-8");
  const [header, line] = csv.replace("﻿", "").split("\n");

  expect(filename).toMatch(/^rapport-detaille_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
  expect(header).toBe('"Date","Début","Fin","Durée","Projet","Description"');
  expect(line).toContain('"08:00","09:30","01:30:00"');
  expect(line).toContain('"Ligne CSV"');
});

test("adds optional columns such as decimal hours and user", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Colonnes en plus", "0800", "0930");
  await openExportDialog(page);

  await page.getByLabel("Heures (décimal)").check();
  await page.getByLabel("Utilisateur").check();

  const { buffer } = await runExport(page);
  const [header, line] = buffer.toString("utf-8").replace("﻿", "").split("\n");
  expect(header).toContain('"Heures (décimal)"');
  expect(header).toContain('"Utilisateur"');
  expect(line).toContain('"1.5"');
  expect(line).toContain("E2E User");
});

test("exports a per-project summary as JSON", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Résumé JSON", "0800", "0930");
  await addManualEntry(page, "Autre entrée", "1000", "1100");
  await openExportDialog(page);

  await page.getByLabel("Résumé par projet").check();
  await page.getByLabel("JSON").check();

  const { filename, buffer } = await runExport(page);
  const data = JSON.parse(buffer.toString("utf-8"));

  expect(filename).toMatch(/^rapport-par-projet_.*\.json$/);
  expect(data[0]).toMatchObject({ Projet: "Aucun projet", Entrées: 2, Durée: "02:30:00", "Heures (décimal)": 2.5 });
  expect(data[data.length - 1]).toMatchObject({ Projet: "Total", Entrées: 2, Durée: "02:30:00" });
});

test("exports a per-day summary as CSV", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Jour un", "0800", "0900");
  await addManualEntry(page, "Jour deux", "0900", "1030");
  await openExportDialog(page);

  await page.getByLabel("Résumé par jour").check();

  const { filename, buffer } = await runExport(page);
  const lines = buffer.toString("utf-8").replace("﻿", "").split("\n");

  expect(filename).toMatch(/^rapport-par-jour_/);
  expect(lines[0]).toBe('"Date","Entrées","Durée","Heures (décimal)"');
  expect(lines[1]).toContain('"2","02:30:00","2.5"');
  expect(lines[2]).toContain('"Total"');
});

test("exports an Excel (.xlsx) workbook", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Ligne Excel", "0800", "0930");
  await openExportDialog(page);

  await page.getByLabel("Excel (.xlsx)").check();
  const { filename, buffer } = await runExport(page);

  expect(filename).toMatch(/^rapport-detaille_.*\.xlsx$/);
  expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  const text = buffer.toString("utf-8");
  expect(text).toContain("xl/worksheets/sheet1.xml");
  expect(text).toContain("Ligne Excel");
  expect(text).toContain("01:30:00");
});

test("disables the export button when no column is selected", async ({ page }) => {
  await registerAndLogin(page);
  await addManualEntry(page, "Sans colonne", "0800", "0900");
  await openExportDialog(page);

  await page.getByRole("button", { name: "Aucune" }).click();
  await expect(page.getByText("Sélectionnez au moins une colonne.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Exporter", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Tout" }).click();
  await expect(page.getByRole("button", { name: "Exporter", exact: true })).toBeEnabled();
});

test("disables the export and explains why when there is nothing to export", async ({ page }) => {
  await registerAndLogin(page);
  await openExportDialog(page);

  await expect(page.getByText("Aucune donnée à exporter pour cette période et ces filtres.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Exporter", exact: true })).toBeDisabled();
});
