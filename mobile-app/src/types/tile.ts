export interface TileData {
  id: number;
  tile: string;  // "Blue_7", "Red_10", "Red_Joker", etc.
  color: "Blue" | "Red" | "Black" | "Orange";
  number: string | null;  // "1" to "13" or null for Jokers
  isJoker: boolean;
  confidence: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation_degrees: number;
  corners: Array<{ x: number; y: number }>;
}

export interface RummikubTile {
  id: number;
  tile: string;
  color: 'Red' | 'Blue' | 'Black' | 'Orange';
  number: string | null;
  isJoker: boolean;
  _source?: 'board' | 'rack';
  _sourceGroupIndex?: number;
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

export interface RummikubMove {
  moveNumber: number;
  type: string;
  description: string;
  tiles: RummikubTile[];
  sourceGroupIndex: number | number[]; 
  targetGroupIndex: number;
}

export interface OptimizeResult {
  tilesUsed: number;
  rackTilesPlayed: RummikubTile[];
  finalBoard: RummikubTile[][];
  moves: RummikubMove[] | null;
  noMoves?: boolean;
}

export interface OptimizeResponse {
  success: boolean;
  data: OptimizeResult;
  message: string;
}
