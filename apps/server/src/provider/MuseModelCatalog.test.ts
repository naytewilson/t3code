import { assert, describe, it } from "@effect/vitest";

import { MUSE_CATALOG_MODELS } from "./MuseModelCatalog.ts";

describe("Muse static model catalog", () => {
  it("lists vendor-bare Muse Spark model slugs with display names", () => {
    assert.isAtLeast(MUSE_CATALOG_MODELS.length, 1);
    const slugs = MUSE_CATALOG_MODELS.map((model) => model.slug);
    assert.include(slugs, "muse-spark-1.2");
    for (const model of MUSE_CATALOG_MODELS) {
      assert.match(model.slug, /^[a-z0-9][a-z0-9.-]*$/);
      assert.isAbove(model.name.length, 0);
      assert.isAbove(model.shortName.length, 0);
    }
    assert.equal(new Set(slugs).size, slugs.length);
  });
});
