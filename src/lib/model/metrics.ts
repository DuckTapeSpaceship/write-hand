// Font-unit coordinate system shared by the drawing cells, the engines and the
// font builder. UPM 1000, baseline at y=0, y grows upward.
export const UPM = 1000

export interface Metrics {
  upm: number
  /** Top of the drawing cell and the font's typo ascender. */
  ascender: number
  /** Bottom of the drawing cell and the font's typo descender (negative). */
  descender: number
  capHeight: number
  xHeight: number
}

export const DEFAULT_METRICS: Metrics = {
  upm: UPM,
  ascender: 750,
  descender: -250,
  capHeight: 680,
  xHeight: 420,
}

/** The square drawing cell in font units: 1000 wide, ascender..descender tall. */
export interface CellBox {
  left: number
  width: number
  top: number
  bottom: number
}

export function cellBox(m: Metrics = DEFAULT_METRICS): CellBox {
  return { left: 0, width: m.ascender - m.descender, top: m.ascender, bottom: m.descender }
}
