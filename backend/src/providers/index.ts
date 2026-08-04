import type { Provider } from "./provider.js";
import { MockProvider } from "./mockProvider.js";
import { KleinanzeigenProvider } from "./kleinanzeigenProvider.js";
import { MarktDeProvider } from "./marktDeProvider.js";

/**
 * Zentrale Registrierung aller Portale.
 * Neue Quelle = neuen Provider implementieren und hier eintragen.
 */
export const ALL_PROVIDERS: Provider[] = [
  new MockProvider(),
  new KleinanzeigenProvider(),
  new MarktDeProvider(),
];

export function activeProviders(): Provider[] {
  return ALL_PROVIDERS.filter((p) => p.enabled);
}

export { Provider };
