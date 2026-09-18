export const FACTIONS = {
  azure: {
    id: 'azure',
    name: 'Azure Motorsport',
    primary: 0x1769ff,
    secondary: 0x0b1220,
    accent: 0x7fd7ff
  },

  crimson: {
    id: 'crimson',
    name: 'Crimson Motorsport',
    primary: 0xe53935,
    secondary: 0x160b0b,
    accent: 0xffa38f
  }
};

export function getFaction(factionId) {
  return FACTIONS[factionId] ?? FACTIONS.azure;
}
