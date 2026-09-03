import { assert, describe, it } from "@effect/vitest";

import { BUILT_IN_DRIVERS } from "./builtInDrivers.ts";

describe("built-in provider drivers", () => {
  it("ships direct Muse Code and Command Code drivers", () => {
    const driverKinds = BUILT_IN_DRIVERS.map((driver) => driver.driverKind);

    assert.include(driverKinds, "muse");
    assert.include(driverKinds, "commandcode");
  });
});
