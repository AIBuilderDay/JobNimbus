export default function BrandMark({ size = 32 }: { size?: number }) {
  const iconSize = Math.round(size * 0.56);
  return (
    <div
      className="rounded-[9px] bg-linear-to-br from-blue-bright to-blue flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
      style={{ width: size, height: size }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 20 20">
        <path
          d="M3 11 L10 4 L17 11 L17 16 L12 16 L12 12 L8 12 L8 16 L3 16 Z"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
