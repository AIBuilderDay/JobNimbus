const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export async function geocode(
  address: string
): Promise<{ lat: number; lng: number }> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);

  const data = await res.json();
  if (!data.results?.length) {
    throw new Error("Address not found. Please check and try again.");
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}
