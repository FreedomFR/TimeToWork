import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("creates a client and a project linked to it, then archives and deletes the project", async ({
  page,
}) => {
  await registerAndLogin(page);

  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByPlaceholder("Nom du client").fill("Acme Corp");
  await page.getByRole("button", { name: "+ Ajouter" }).click();
  await expect(page.getByText("Acme Corp")).toBeVisible();

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("Website Redesign");
  await page.getByRole("combobox").selectOption({ label: "Acme Corp" });
  await page.getByRole("button", { name: "+ Ajouter" }).click();

  await expect(page.getByText("Website Redesign")).toBeVisible();
  await expect(page.getByText("Acme Corp").last()).toBeVisible();

  await page.getByRole("button", { name: "Archiver" }).click();
  await expect(page.getByText("Réactiver")).toBeVisible();

  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Aucun projet créé")).toBeVisible();
});

test("deleting a client clears it from projects that referenced it", async ({ page }) => {
  await registerAndLogin(page);

  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByPlaceholder("Nom du client").fill("Temp Client");
  await page.getByRole("button", { name: "+ Ajouter" }).click();

  await page.getByRole("link", { name: "Projets" }).click();
  await page.getByPlaceholder("Nom du projet").fill("Linked Project");
  await page.getByRole("combobox").selectOption({ label: "Temp Client" });
  await page.getByRole("button", { name: "+ Ajouter" }).click();
  await expect(page.getByText("Temp Client").last()).toBeVisible();

  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Aucun client créé")).toBeVisible();

  await page.getByRole("link", { name: "Projets" }).click();
  await expect(page.getByText("Linked Project")).toBeVisible();
  await expect(page.getByText("Temp Client")).not.toBeVisible();
});
