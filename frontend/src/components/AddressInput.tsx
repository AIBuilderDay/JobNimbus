import { useState } from "react";
import { startEstimate } from "../api/estimate";
import type { BuildingInsightsResponse } from "../types/solar";

const SAMPLE_ADDRESSES = [
  "1600 Amphitheatre Parkway, Mountain View, CA",
  "3055 E Willetta St, Phoenix, AZ",
  "1433 E Harrison Ave, Salt Lake City, UT",
  "101 California St, San Francisco, CA",
];

interface Props {
  onResult: (
    location: { lat: number; lng: number },
    data: BuildingInsightsResponse
  ) => void;
  onError: (msg: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

export default function AddressInput({
  onResult,
  onError,
  onLoadingChange,
}: Props) {
  const [address, setAddress] = useState("");

  async function handleSubmit(overrideAddress?: string) {
    const trimmed = (overrideAddress ?? address).trim();
    if (!trimmed) return;

    setAddress(trimmed);
    onError("");
    onLoadingChange(true);

    try {
      const result = await startEstimate(trimmed);
      if (!result.buildingInsights) {
        throw new Error("No solar data available for this building.");
      }
      onResult(result.location, result.buildingInsights);
    } catch (err) {
      onError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      onLoadingChange(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Enter a US address…"
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => handleSubmit()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
        >
          Load Building
        </button>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1.5">Try a sample address:</p>
        <div className="flex flex-col gap-1">
          {SAMPLE_ADDRESSES.map((addr) => (
            <button
              key={addr}
              onClick={() => handleSubmit(addr)}
              className="text-left text-xs text-blue-400 hover:text-blue-300 truncate transition-colors"
            >
              {addr}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
