import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("edits a project's name, color and client inline", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByPlaceholder("Nom du client").fill("Nouveau client");
  await page.getByRole("button", { name: "+ Ajouter" }).click();

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("Projet brouillon");
  await page.getByRole("button", { name: "+ Ajouter" }).click();
  await expect(page.getByText("Projet brouillon")).toBeVisible();

  await page.getByText("Projet brouillon").click();
  const nameInput = page.getByPlaceholder("Nom du projet").last();
  await nameInput.fill("Projet final");
  await nameInput.blur();
  await expect(page.getByText("Projet final")).toBeVisible();
  await expect(page.getByText("Projet brouillon")).not.toBeVisible();

  await page.getByRole("combobox").last().selectOption({ label: "Nouveau client" });
  await expect(page.locator("span").filter({ hasText: "Nouveau client" })).toBeVisible();
});

test("edits a client's name inline", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByPlaceholder("Nom du client").fill("Nom brouillon");
  await page.getByRole("button", { name: "+ Ajouter" }).click();
  await expect(page.getByText("Nom brouillon")).toBeVisible();

  await page.getByText("Nom brouillon").click();
  const nameInput = page.getByPlaceholder("Nom du client").last();
  await nameInput.fill("Nom final");
  await nameInput.blur();

  await expect(page.getByText("Nom final")).toBeVisible();
  await expect(page.getByText("Nom brouillon")).not.toBeVisible();
});

test("archiving and deleting a project still works after adding inline edit", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("À archiver");
  await page.getByRole("button", { name: "+ Ajouter" }).click();

  await page.getByRole("button", { name: "Archiver" }).click();
  await expect(page.getByRole("button", { name: "Réactiver" })).toBeVisible();

  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Aucun projet créé")).toBeVisible();
});
