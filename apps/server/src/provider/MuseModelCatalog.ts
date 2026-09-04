/**
 * MuseModelCatalog — explicit static model list for the direct Muse Code CLI
 * driver.
 *
 * Why static: as of Muse Code 1.0.2 the CLI exposes no supported
 * model-list/catalog operation. Verified 2026-09-04 against the installed
 * binary (`~/.local/bin/muse`, `muse --help` + `muse exec --help`):
 * - the 12 subcommands are resume/exec/config/export/trace/skills/sandbox/
 *   schema/serve/session-message/auth/login/logout/init — none lists models;
 * - `muse exec` accepts `--model <id>` but offers no listing flag;
 * - `muse config status` reports only enterprise-config planes, no models.
 * Do NOT invent an ACP/MSP discovery layer to make this dynamic. When a
 * future `muse` release gains a list operation, replace this catalog with
 * live discovery mirroring CommandCodeDriver's `--list-models` support.
 *
 * Evidence per entry (`--model` ids are the bare names after the last `/`):
 * - muse-spark-1.1 / 1.2 / 1.2-contributor: Meta section of
 *   `command-code --list-models` (v1.15.1), which names the same
 *   `meta/muse-spark-*` model family;
 * - muse-spark-1.3-contributor: current Muse Spark contributor tier
 *   (same family; validated by the live T3 Muse session proof).
 *
 * @module provider/MuseModelCatalog
 */
export interface MuseCatalogModel {
  readonly slug: string;
  readonly name: string;
  readonly shortName: string;
}

export const MUSE_CATALOG_MODELS: ReadonlyArray<MuseCatalogModel> = [
  { slug: "muse-spark-1.1", name: "Muse Spark 1.1", shortName: "1.1" },
  { slug: "muse-spark-1.2", name: "Muse Spark 1.2", shortName: "1.2" },
  {
    slug: "muse-spark-1.2-contributor",
    name: "Muse Spark 1.2 Contributor",
    shortName: "1.2-contributor",
  },
  {
    slug: "muse-spark-1.3-contributor",
    name: "Muse Spark 1.3 Contributor",
    shortName: "1.3-contributor",
  },
];
