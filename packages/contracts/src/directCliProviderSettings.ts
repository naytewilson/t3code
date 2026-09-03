import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { TrimmedString } from "./baseSchemas.ts";

const makeBinaryPathSetting = (fallback: string) =>
  TrimmedString.pipe(Schema.withDecodingDefault(Effect.succeed(fallback)));

const makeDirectCliSettings = (input: {
  readonly binaryPath: string;
  readonly binaryDescription: string;
}) =>
  Schema.Struct({
    enabled: Schema.Boolean.pipe(
      Schema.withDecodingDefault(Effect.succeed(false)),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
    binaryPath: makeBinaryPathSetting(input.binaryPath).pipe(
      Schema.annotateKey({
        title: "Binary path",
        description: input.binaryDescription,
        providerSettingsForm: {
          placeholder: input.binaryPath,
          clearWhenEmpty: "omit",
        },
      }),
    ),
    customModels: Schema.Array(Schema.String).pipe(
      Schema.withDecodingDefault(Effect.succeed([])),
      Schema.annotateKey({ providerSettingsForm: { hidden: true } }),
    ),
  });

/** Settings for the direct Meta Muse Code CLI driver. */
export const MuseSettings = makeDirectCliSettings({
  binaryPath: "muse",
  binaryDescription: "Path to the Meta Muse Code CLI binary used by this instance.",
});
export type MuseSettings = typeof MuseSettings.Type;

/** Settings for the direct Command Code CLI driver. */
export const CommandCodeSettings = makeDirectCliSettings({
  binaryPath: "command-code",
  binaryDescription: "Path to the Command Code CLI binary used by this instance.",
});
export type CommandCodeSettings = typeof CommandCodeSettings.Type;
