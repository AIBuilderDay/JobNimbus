interface Props {
  credits: string;
}

export default function Attribution({ credits }: Props) {
  return (
    <div className="absolute bottom-0 right-0 flex items-center gap-2 px-3 py-1.5 bg-black/70 text-xs text-gray-300 rounded-tl pointer-events-none">
      <img
        src="https://www.gstatic.com/mapspro/images/stock/google_on_white_hdpi.png"
        alt="Google"
        className="h-4 brightness-200"
      />
      {credits && <span className="max-w-[400px] truncate">{credits}</span>}
    </div>
  );
}
