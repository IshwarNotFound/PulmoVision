export type ViewMode = "original" | "overlay" | "3d" | "split";

export interface ViewState {
  mode: ViewMode;
  overlayOpacity: number;
  threshold: number;
  zoom: number;
  hoveredCell: { i: number; j: number } | null;
}
