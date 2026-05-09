import { z } from "zod";

const LatLng = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const SizeAndSunshineStats = z.object({
  areaMeters2: z.number(),
  sunshineQuantiles: z.array(z.number()),
  groundAreaMeters2: z.number(),
});

export const RoofSegmentStatSchema = z.object({
  pitchDegrees: z.number(),
  azimuthDegrees: z.number(),
  stats: SizeAndSunshineStats,
  center: LatLng,
  boundingBox: z.object({
    sw: LatLng,
    ne: LatLng,
  }),
  planeHeightAtCenterMeters: z.number(),
});

const WholeRoofStats = z.object({
  areaMeters2: z.number(),
  sunshineQuantiles: z.array(z.number()),
  groundAreaMeters2: z.number(),
});

const SolarPotential = z.object({
  maxArrayPanelsCount: z.number(),
  maxSunshineHoursPerYear: z.number(),
  wholeRoofStats: WholeRoofStats,
  roofSegmentStats: z.array(RoofSegmentStatSchema),
});

export const BuildingInsightsSchema = z.object({
  name: z.string().optional(),
  center: LatLng,
  regionCode: z.string().optional(),
  solarPotential: SolarPotential,
  imageryQuality: z.string().optional(),
});

export type RoofSegmentStat = z.infer<typeof RoofSegmentStatSchema>;
export type BuildingInsightsResponse = z.infer<typeof BuildingInsightsSchema>;
