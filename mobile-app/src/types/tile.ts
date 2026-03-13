export interface TileData {
  id: number;
  tile: string;  // "Blue_7", "Red_10", "Joker", etc.
  color: "Blue" | "Red" | "Black" | "Orange";
  number: string;  // "1" to "13" or "0"/"joker"
  confidence: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation_degrees: number;
  corners: Array<{ x: number; y: number }>;
}

export interface TilePosition {
  groupIdx: number;  // -1 for rack (flat array), 0+ for board groups
  tileIdx: number;
}

export interface DetectionResponse {
  success: boolean;
  data: {
    imageWidth: number;
    imageHeight: number;
    numTilesDetected: number;
    rack?: TileData[];
    groups?: TileData[][];
    numSeriesDetected?: number;
  };
  message: string;
}
