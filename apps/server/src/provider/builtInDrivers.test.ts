import { describe, it, assert } from "@effect/vitest";
import { ProviderDriverKind } from "@t3tools/contracts";

import { BUILT_IN_DRIVERS } from "./builtInDrivers.ts";

describe("built-in provider drivers", () => {
  it("ships direct Muse Code and Command Code drivers", () => {
    const driverKinds = BUILT_IN_DRIVERS.map((driver) => driver.driverKind);

    assert.equal(driverKinds.includes(ProviderDriverKind.make("muse")), true);
    assert.equal(driverKinds.includes(ProviderDriverKind.make("commandcode")), true);
  });
});
