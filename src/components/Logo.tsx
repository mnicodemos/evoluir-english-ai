import logoAsset from "@/assets/logo.png.asset.json";

export function Logo({ className = "size-7", invert = false }: { className?: string; invert?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-white ${className}`}
    >
      <img
        src={logoAsset.url}
        alt="Evoluir+ English AI logo"
        className={`block h-full w-full shrink-0 self-center object-contain p-0.5 ${invert ? "invert" : ""}`}
      />
    </span>
  );
}
