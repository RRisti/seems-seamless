const LAYOUT_VARIATIONS = [4, 1, 2];
let index = 0;

export const getNextGridLayout = () => LAYOUT_VARIATIONS[index++ % LAYOUT_VARIATIONS.length];
