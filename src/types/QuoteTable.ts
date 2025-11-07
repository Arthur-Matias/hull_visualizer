// types.ts - Updated interfaces
export interface QuoteTable {
  stations: Station[];
  metadata: QuoteTableMetadata;
}

export interface QuoteTableMetadata {
  weight: number;
  hasKeel?: boolean;
  hasChine?: boolean;
  thickness: number;
  units: 'mm' | 'ft' | 'm';
  symmetry?: 'symmetric' | 'asymmetric';
}

export interface Station {
  position: number; // Station position (z-coordinate)
  waterlines: WaterlineData[];
}

export interface WaterlineData {
  height: number; // Waterline height (y-coordinate)
  halfBreadthPort: number;
  halfBreadthStarboard?: number; // Optional - if missing, use port value (symmetric)
}