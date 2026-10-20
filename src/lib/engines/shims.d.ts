declare module 'imagetracerjs' {
  const ImageTracer: {
    imagedataToTracedata(
      img: { width: number; height: number; data: Uint8ClampedArray },
      options: Record<string, unknown>,
    ): { layers: any[][]; palette: { r: number; g: number; b: number; a: number }[] }
  }
  export default ImageTracer
}
