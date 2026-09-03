/**
 * CommandCodeAdapter — shape type for the Command Code provider adapter.
 *
 * @module CommandCodeAdapter
 */
import type { ProviderAdapterError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

/**
 * CommandCodeAdapterShape — per-instance Command Code adapter contract.
 */
export interface CommandCodeAdapterShape extends ProviderAdapterShape<ProviderAdapterError> {}
