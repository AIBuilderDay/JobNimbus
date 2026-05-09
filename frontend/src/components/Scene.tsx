import { memo, useMemo, useCallback, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import type { PickingInfo } from "@deck.gl/core";
import type { BuildingInsightsResponse } from "../types/solar";
import { createRoofSegmentLayer } from "../layers/roofSegmentLayer";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

interface Props {
  location: { lat: number; lng: number } | null;
  buildingInsights: BuildingInsightsResponse | null;
  selectedIndices: number[];
  onToggleSegment: (index: number) => void;
  onClearSegments: () => void;
  onCreditsUpdate: (credits: string) => void;
  topDown?: boolean;
}

const CONTROLLER_OPTS = { inertia: true, dragRotate: true } as const;

function getCursor({ isHovering }: { isHovering: boolean }) {
  return isHovering ? "pointer" : "grab";
}

export default memo(function Scene({
  location,
  buildingInsights,
  selectedIndices,
  onToggleSegment,
  onCreditsUpdate,
  topDown = false,
}: Props) {
  const viewState = useMemo(() => {
    // Prefer the building center (where Solar actually measured) over the geocoded
    // address point (often a driveway/parking spot offset from the structure).
    const center = buildingInsights?.center
      ? { lng: buildingInsights.center.longitude, lat: buildingInsights.center.latitude }
      : location;

    if (!center) {
      return {
        longitude: -122.084,
        latitude: 37.422,
        zoom: topDown ? 19 : 18,
        pitch: topDown ? 0 : 60,
        bearing: 0,
      };
    }
    return {
      longitude: center.lng,
      latitude: center.lat,
      zoom: topDown ? 19 : 18,
      pitch: topDown ? 0 : 60,
      bearing: 0,
    };
  }, [location, buildingInsights, topDown]);

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
        operation: "terrain+draw",
      }),
    [handleTilesetLoad]
  );

  const roofLayer = useMemo(() => {
    if (!buildingInsights) return null;
    return createRoofSegmentLayer(
      buildingInsights.segments,
      selectedIndices
    );
  }, [buildingInsights, selectedIndices]);

  const layers = useMemo(
    () => (roofLayer ? [tileLayer, roofLayer] : [tileLayer]),
    [tileLayer, roofLayer]
  );

  const handleClick = useCallback(
    (info: PickingInfo) => {
      console.log("[Scene click]", { layerId: info.layer?.id, object: info.object, selectedIndices });
      if (info.layer?.id === "roof-segments" && info.object) {
        const feature = info.object as { properties?: { index?: number } };
        const idx = feature.properties?.index ?? -1;
        if (idx < 0) return;
        console.log("[Scene] toggling segment", idx);
        onToggleSegment(idx);
      }
    },
    [onToggleSegment, selectedIndices]
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
