import logoAsset from "@/assets/evoluir-logo-new.png.asset.json";

export function Logo({
  className = "size-[2.2rem]",
  invert = false,
}: {
  className?: string;
  invert?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-white ${className}`}
    >
      <img
        src={logoAsset.url}
        alt="Evoluir+ English AI logo"
        className={`block h-[80%] w-[80%] shrink-0 self-center object-contain ${invert ? "invert" : ""}`}
      />
    </span>
  );
}
