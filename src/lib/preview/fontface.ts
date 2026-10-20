// fontify's preview mechanism (App.tsx, MIT, github.com/alexkroeker177/fontify):
// wrap the freshly built font in a FontFace, swap it into document.fonts under
// a fixed family name, and let CSS `font-family` pick it up. Characters the
// font lacks fall back to the next family in the stack.
export class FaceSwapper {
  private current: FontFace | null = null
  private seq = 0

  constructor(readonly family: string) {}

  /** Resolves true once the new face is live (false if a newer swap won). */
  async swap(buffer: ArrayBuffer | null): Promise<boolean> {
    const seq = ++this.seq
    if (!buffer) {
      this.clear()
      return true
    }
    const face = new FontFace(this.family, buffer)
    await face.load()
    if (seq !== this.seq) return false
    if (this.current) document.fonts.delete(this.current)
    document.fonts.add(face)
    this.current = face
    return true
  }

  clear(): void {
    if (this.current) document.fonts.delete(this.current)
    this.current = null
  }
}
