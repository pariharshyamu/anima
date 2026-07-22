/**
 * Outfit palettes: pools the generator picks from per seed, so a crowd
 * built from one palette looks like inhabitants of the same place while
 * every individual differs. Structure mirrors SCENA's palette idea.
 */
export interface OutfitPalette {
  skin: number[];
  hair: number[];
  shirt: number[];
  pants: number[];
  boots: number[];
}

export const OUTFITS: Record<'villager' | 'guard' | 'winter', OutfitPalette> = {
  villager: {
    skin: [0xe8b58c, 0xd29b6e, 0xb87f54, 0x8f5f3f, 0xf0c8a0],
    hair: [0x3a2a1e, 0x5d4030, 0x8a6642, 0xb8b8b8, 0x1e1a16],
    shirt: [0x7d9e5e, 0xa8763e, 0x6e86a8, 0xb05c50, 0xc9b98a],
    pants: [0x5d4a3a, 0x46525e, 0x6b5a45, 0x3e4a3e],
    boots: [0x3a2e24, 0x4a3a2c, 0x2e2a26],
  },
  guard: {
    skin: [0xe8b58c, 0xd29b6e, 0xb87f54, 0x8f5f3f],
    hair: [0x3a2a1e, 0x5d4030, 0x1e1a16],
    shirt: [0x46525e, 0x3d4451, 0x5a3e3e, 0x39404d],
    pants: [0x2e3440, 0x3a3630],
    boots: [0x26221e, 0x2e2a26],
  },
  winter: {
    skin: [0xe8b58c, 0xd29b6e, 0xb87f54, 0xf0c8a0],
    hair: [0x3a2a1e, 0x8a6642, 0xb8b8b8],
    shirt: [0x6e86a8, 0x8a5c50, 0x77836b, 0x9a8a6e],
    pants: [0x46525e, 0x4a4038],
    boots: [0x3a2e24, 0x2e2a26],
  },
};

export const DEFAULT_OUTFIT: OutfitPalette = OUTFITS.villager;
