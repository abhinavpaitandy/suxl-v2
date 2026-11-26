declare module "heatmap.js" {
  interface Heatmap {
    setData(data: {
      min: number;
      max: number;
      data: Array<{ x: number; y: number; value: number }>;
    }): void;
  }
  const heatmap: {
    create(config: {
      container: HTMLElement;
      radius: number;
      maxOpacity: number;
      minOpacity: number;
      blur: number;
    }): Heatmap;
  };
  export default heatmap;
}
