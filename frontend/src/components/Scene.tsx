import { memo, useMemo, useCallback, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import type { PickingInfo } from "@deck.gl/core";
import type { BuildingInsightsResponse, RoofSegment } from "../types/solar";
import { createRoofSegmentLayer } from "../layers/roofSegmentLayer";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

interface Props {
  location: { lat: number; lng: number } | null;
  buildingInsights: BuildingInsightsResponse | null;
  selectedIndex: number;
  onSelectSegment: (segment: RoofSegment | null, index: number) => void;
  onCreditsUpdate: (credits: string) => void;
}

const CONTROLLER_OPTS = { inertia: true, dragRotate: true } as const;

function getCursor({ isHovering }: { isHovering: boolean }) {
  return isHovering ? "pointer" : "grab";
}

export default memo(function Scene({
  location,
  buildingInsights,
  selectedIndex,
  onSelectSegment,
  onCreditsUpdate,
}: Props) {
  const viewState = useMemo(() => {
    if (!location) {
      return {
        longitude: -122.084,
        latitude: 37.422,
        zoom: 18,
        pitch: 60,
        bearing: 0,
      };
    }
    return {
      longitude: location.lng,
      latitude: location.lat,
      zoom: 18,
      pitch: 60,
      bearing: 0,
    };
  }, [location]);

  const creditsRef = useRef(onCreditsUpdate);
  creditsRef.current = onCreditsUpdate;

  const handleTilesetLoad = useCallback((tileset: unknown) => {
    const ts = tileset as { asset?: { copyright?: string } };
    if (ts.asset?.copyright) {
      const parts = ts.asset.copyright
        .split(";")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const unique = [...new Set(parts)];
      creditsRef.current(unique.join("; "));
    }
  }, []);

  const tileLayer = useMemo(
    () =>
      new Tile3DLayer({
        id: "google-3d-tiles",
        data: "https://tile.googleapis.com/v1/3dtiles/root.json",
        loadOptions: {
          fetch: { headers: { "X-GOOG-API-KEY": API_KEY } },
        },
        onTilesetLoad: handleTilesetLoad,
        maximumScreenSpaceError: 8,
      }),
    [handleTilesetLoad]
  );

  const roofLayer = useMemo(() => {
    if (!buildingInsights) return null;
    return createRoofSegmentLayer(
      buildingInsights.segments,
      selectedIndex
    );
  }, [buildingInsights, selectedIndex]);

  const layers = useMemo(
    () => (roofLayer ? [tileLayer, roofLayer] : [tileLayer]),
    [tileLayer, roofLayer]
  );

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (info.layer?.id === "roof-segments" && info.object) {
        const segs = buildingInsights!.segments;
        const idx = segs.indexOf(info.object as RoofSegment);
        onSelectSegment(info.object as RoofSegment, idx);
      } else {
        onSelectSegment(null, -1);
      }
    },
    [buildingInsights, onSelectSegment]
  );

  return (
    <DeckGL
      initialViewState={viewState}
      controller={CONTROLLER_OPTS}
      layers={layers}
      onClick={handleClick}
      getCursor={getCursor}
      useDevicePixels={1}
      style={{ position: "absolute", inset: "0" }}
    />
  );
});
