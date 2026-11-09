import { ViewState } from '../types';

const MAPLIBRE_TILE_SIZE = 512;

/**
 * Blokuje poziom (zoom) pobieranych kafelków, czyli to, które zdjęcia satelitarne są pokazywane.
 * MapLibre dla źródeł rastrowych wybiera poziom kafelków jako
 *   round(zoomMapy + log2(512 / tileSize)),
 * więc przy zmianie przybliżenia dobieramy tileSize (potęga dwójki) tak,
 * aby ten poziom zawsze wychodził taki sam jak dla widoku bazowego i wybranej jakości.
 */
export function getLockedTileSize(baseZoom: number, tileSize: number, currentZoom: number): number {
  const lockedLevel = Math.round(baseZoom + Math.log2(MAPLIBRE_TILE_SIZE / tileSize));
  return Math.pow(2, Math.round(Math.log2(MAPLIBRE_TILE_SIZE) + currentZoom - lockedLevel));
}

/**
 * Zamienia przesunięcie/skalę sceny Konva na prawdziwą kamerę MapLibre,
 * dzięki czemu mapa sama dociąga kafelki dla aktualnie widocznego obszaru.
 * Punkt (0,0) współrzędnych kształtów odpowiada środkowi bazowego viewState.
 */
export function getCameraViewState(
  base: ViewState,
  stagePos: { x: number; y: number },
  stageScale: number,
  originX: number,
  originY: number
): ViewState {
  const zoom = base.zoom + Math.log2(stageScale);
  const worldSize = MAPLIBRE_TILE_SIZE * Math.pow(2, zoom);

  const sinLat = Math.sin((base.latitude * Math.PI) / 180);
  const px = ((base.longitude + 180) / 360) * worldSize;
  const py = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize;

  // pozycja na ekranie, w której ma wylądować bazowy środek mapy
  const cx = stagePos.x + stageScale * originX;
  const cy = stagePos.y + stageScale * originY;

  const nx = px + (originX - cx);
  const ny = py + (originY - cy);

  const longitude = (nx / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * ny) / worldSize;
  const latitude = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return { ...base, longitude, latitude, zoom };
}
