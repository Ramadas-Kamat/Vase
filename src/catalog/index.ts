/**
 * Catalog entry point. Importing this module populates the registry.
 *
 * `store/store.ts` imports it first thing, because the store's initial state
 * builds a preset arrangement and therefore needs flower and vase types to
 * already be registered. Import order is load-bearing; don't remove it.
 */
import './vases';
import './flowers';
