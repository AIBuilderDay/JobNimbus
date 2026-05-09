import { z } from "zod";

const LatLng = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const RoofSegmentSchema = z.object({
  id: z.number(),
  pitch_degrees: z.number().nullable(),
  azimuth_degrees: z.number().nullable(),
  area_sq_ft: z.number(),
  ground_area_sq_ft: z.number(),
  plane_height_meters: z.number().nullable(),
  bounding_box: z.object({
    sw: LatLng,
    ne: LatLng,
  }).nullable().optional(),
  center: LatLng.nullable().optional(),
  polygon: z.array(z.array(z.number()).length(3)).nullable().optional(),
});

export const BuildingInsightsSchema = z.object({
  name: z.string().optional(),
  center: LatLng.optional(),
  imagery_quality: z.string().optional(),
  segments: z.array(RoofSegmentSchema),
  total_roof_area_sq_ft: z.number(),
});

export type RoofSegment = z.infer<typeof RoofSegmentSchema>;
export type BuildingInsightsResponse = z.infer<typeof BuildingInsightsSchema>;

// Keep old name as alias for backward compatibility during migration
export type RoofSegmentStat = RoofSegment;
