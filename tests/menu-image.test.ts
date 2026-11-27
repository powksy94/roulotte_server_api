import request from "supertest";
import { describe, expect, it } from "vitest";
import { DishImageService } from "../src/modules/menu/image/dish-image.service.js";
import type { MenuRepository } from "../src/modules/menu/menu.repository.js";
import { buildTestApp, dish, loginAs } from "./helpers/test-app.js";

// PNG 1×1 valide
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const asPng = { filename: "photo.png", contentType: "image/png" };

describe("DishImageService (unitaire)", () => {
  function setup() {
    const saved: string[] = [];
    const removed: string[] = [];
    const storage = {
      save: async (_content: Buffer, ext: string) => {
        const url = `/uploads/dishes/n${saved.length}.${ext}`;
        saved.push(url);
        return url;
      },
      remove: async (url: string) => {
        removed.push(url);
      },
    };
    const menu: Pick<MenuRepository, "findDishById" | "setDishImage"> = {
      findDishById: async (id) => (id === 1 ? dish(1, "Le Classique", { imageUrl: "/uploads/dishes/ancienne.png" }) : null),
      setDishImage: async (id, imageUrl) => dish(id, "Le Classique", { imageUrl }),
    };
    return { saved, removed, service: new DishImageService(menu, storage) };
  }

  it("enregistre la nouvelle photo et supprime l'ancienne", async () => {
    const { saved, removed, service } = setup();
    const updated = await service.setDishImage(1, { buffer: PNG });
    expect(updated.imageUrl).toBe("/uploads/dishes/n0.png");
    expect(saved).toEqual(["/uploads/dishes/n0.png"]);
    expect(removed).toEqual(["/uploads/dishes/ancienne.png"]);
  });

  it("un faux PNG → 415, rien n'est écrit", async () => {
    const { saved, service } = setup();
    await expect(service.setDishImage(1, { buffer: Buffer.from("je ne suis pas une image") })).rejects.toMatchObject({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
    expect(saved).toEqual([]);
  });

  it("sans fichier → 400, plat inexistant → 404", async () => {
    const { saved, service } = setup();
    await expect(service.setDishImage(1, undefined)).rejects.toMatchObject({ status: 400 });
    await expect(service.setDishImage(999, { buffer: PNG })).rejects.toMatchObject({ status: 404 });
    expect(saved).toEqual([]);
  });
});

describe("PUT /dishes/:id/image (HTTP)", () => {
  it("200, imageUrl, image servie et affichable depuis le front (CORP)", async () => {
    const { app, users } = buildTestApp();
    const { token } = await loginAs(app, users, "ADMIN");

    const res = await request(app).put("/dishes/1/image").set("Authorization", `Bearer ${token}`).attach("image", PNG, asPng);

    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(/^\/uploads\/dishes\/.+\.png$/);
    expect((await request(app).get("/dishes/1")).body.imageUrl).toBe(res.body.imageUrl);
    const img = await request(app).get(res.body.imageUrl);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
    expect(img.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("une nouvelle photo remplace l'ancienne, qui n'est plus servie", async () => {
    const { app, users } = buildTestApp();
    const { token } = await loginAs(app, users, "ADMIN");
    const put = () => request(app).put("/dishes/1/image").set("Authorization", `Bearer ${token}`).attach("image", PNG, asPng);

    const first = (await put()).body.imageUrl;
    const second = (await put()).body.imageUrl;

    expect(second).not.toBe(first);
    expect((await request(app).get(first)).status).toBe(404);
  });

  it("faux PNG → 415, plus de 2 Mo → 413, sans fichier → 400", async () => {
    const { app, users } = buildTestApp();
    const { token } = await loginAs(app, users, "ADMIN");
    const put = () => request(app).put("/dishes/1/image").set("Authorization", `Bearer ${token}`);

    const fake = await put().attach("image", Buffer.from("je ne suis pas une image"), asPng);
    expect(fake.status).toBe(415);
    expect(fake.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    const big = await put().attach("image", Buffer.concat([PNG, Buffer.alloc(2.5 * 1024 * 1024)]), asPng);
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe("PAYLOAD_TOO_LARGE");

    const none = await put().field("autre", "valeur");
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("réservé à l'admin (403), plat inexistant → 404", async () => {
    const { app, users } = buildTestApp();
    const staff = await loginAs(app, users, "STAFF");
    const admin = await loginAs(app, users, "ADMIN");

    const forbidden = await request(app).put("/dishes/1/image").set("Authorization", `Bearer ${staff.token}`).attach("image", PNG, asPng);
    expect(forbidden.status).toBe(403);
    const missing = await request(app).put("/dishes/999/image").set("Authorization", `Bearer ${admin.token}`).attach("image", PNG, asPng);
    expect(missing.status).toBe(404);
  });
});