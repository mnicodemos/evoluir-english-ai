import { useEffect, useRef } from "react";

/** Fit actual translated text, never the viewport; reserve the original line box. */
export function TodayProgressText({ value, label, valueClass }: {
  value: string; label: string; valueClass: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const line = ref.current;
    const number = line?.querySelector<HTMLElement>("[data-value]");
    const content = line?.querySelector<HTMLElement>("[data-content]");
    if (!line || !number || !content) return;
    let disposed = false;
    const fit = () => {
      if (disposed || !line.clientWidth) return;
      line.style.fontSize = "";
      number.style.fontSize = "";
      const base = getComputedStyle(line);
      const size = parseFloat(base.fontSize);
      const numberSize = parseFloat(getComputedStyle(number).fontSize);
      const scale = Math.min(1, (line.clientWidth - 1) / Math.max(1, content.getBoundingClientRect().width));
      line.style.fontSize = `${size * scale}px`;
      number.style.fontSize = `${numberSize * scale}px`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(line);
    fit();
    void document.fonts.ready.then(fit);
    return () => { disposed = true; observer.disconnect(); };
  }, [value, label]);
  return (
    <p ref={ref} className="min-w-0 whitespace-nowrap text-[11px] leading-[20px] text-muted-foreground lg:leading-[21px] xl:text-[10px] xl:leading-[18px] 2xl:text-[11px] 2xl:leading-[21px]">
      <span data-content className="inline-block whitespace-nowrap">
        <span data-value className={`font-display text-[13px] font-semibold lg:text-sm lg:font-bold ${valueClass}`}>{value}</span>
        <span className="ml-1.5">{label}</span>
      </span>
    </p>
  );
}