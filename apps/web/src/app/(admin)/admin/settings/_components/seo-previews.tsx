"use client";

import { useState, type CSSProperties, type SVGProps } from "react";

export type SeoPreviewData = {
  title: string;
  description: string;
  siteName: string;
  siteUrl: string;
  imageUrl: string | null;
  themeColor: string;
  twitterCard: "summary" | "summary_large_image";
  twitterSite: string;
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isValidHex(color: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color);
}

function SafeImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [errored, setErrored] = useState(false);
  if (errored || !src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => setErrored(true)} />;
}

function ThemeSwitcher<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; icon: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 self-end z-10">
      {options.map(({ key, icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex items-center justify-center w-7 h-7 rounded-md text-base transition-colors ${
            value === key
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme icons
// ---------------------------------------------------------------------------

function IconLightMode(p: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...p}>
      <path fill="currentColor" d="M12 17q-2.075 0-3.537-1.463T7 12t1.463-3.537T12 7t3.538 1.463T17 12t-1.463 3.538T12 17m-7-4H1v-2h4zm18 0h-4v-2h4zM11 5V1h2v4zm0 18v-4h2v4zM6.4 7.75L3.875 5.325L5.3 3.85l2.4 2.5zm12.3 12.4l-2.425-2.525L17.6 16.25l2.525 2.425zM16.25 6.4l2.425-2.525L20.15 5.3l-2.5 2.4zM3.85 18.7l2.525-2.425L7.75 17.6l-2.425 2.525z" />
    </svg>
  );
}

function IconDarkMode(p: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...p}>
      <path fill="currentColor" d="M12 21q-3.75 0-6.375-2.625T3 12t2.625-6.375T12 3q.35 0 .688.025t.662.075q-1.025.725-1.637 1.887T11.1 7.5q0 2.25 1.575 3.825T16.5 12.9q1.375 0 2.525-.613T20.9 10.65q.05.325.075.662T21 12q0 3.75-2.625 6.375T12 21" />
    </svg>
  );
}

function IconNight(p: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...p}>
      <path fill="currentColor" d="M13.1 23h-2.6l.5-.312q.5-.313 1.088-.7t1.087-.7l.5-.313q2.025-.15 3.738-1.225t2.712-2.875q-2.15-.2-4.075-1.088t-3.45-2.412t-2.425-3.45T9.1 5.85Q7.175 6.925 6.088 8.813T5 12.9v.3l-.3.138q-.3.137-.663.287t-.662.288l-.3.137q-.05-.275-.062-.575T3 12.9q0-3.65 2.325-6.437T11.25 3q-.45 2.475.275 4.838t2.5 4.137t4.138 2.5T23 14.75q-.65 3.6-3.45 5.925T13.1 23M6 21h4.5q.625 0 1.063-.437T12 19.5t-.425-1.062T10.55 18h-1.3l-.5-1.2q-.35-.825-1.1-1.312T6 15q-1.25 0-2.125.863T3 18q0 1.25.875 2.125T6 21m0 2q-2.075 0-3.537-1.463T1 18t1.463-3.537T6 13q1.5 0 2.738.813T10.575 16Q12 16.05 13 17.063t1 2.437q0 1.45-1.025 2.475T10.5 23z" />
    </svg>
  );
}

function IconCloud(p: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...p}>
      <path fill="currentColor" d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5c0-2.64-2.05-4.78-4.65-4.96M19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71C7.37 7.69 9.48 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3" />
    </svg>
  );
}

function IconPartlyCloudy(p: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...p}>
      <path fill="currentColor" d="M12 5q-.425 0-.712-.288T11 4V2q0-.425.288-.712T12 1t.713.288T13 2v2q0 .425-.288.713T12 5m4.95 2.05q-.275-.275-.275-.7t.275-.7l1.4-1.425q.3-.3.712-.3t.713.3q.275.275.275.7t-.275.7L18.35 7.05q-.275.275-.7.275t-.7-.275M20 13q-.425 0-.713-.288T19 12t.288-.712T20 11h2q.425 0 .713.288T23 12t-.288.713T22 13zm-8 8q-2.075 0-3.537-1.463T7 16t1.463-3.537T12 11q1.45 0 2.613.8t1.762 2.1q1.45 0 2.538 1.075T20 17.65q-.05 1.425-1.063 2.388T16.5 21zm0-2h4.5q.625 0 1.063-.437T18 17.5t-.425-1.062T16.55 16h-1.3l-.5-1.2q-.35-.825-1.1-1.312T12 13q-1.25 0-2.125.875T9 16t.875 2.125T12 19" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Discord Preview
// ---------------------------------------------------------------------------

type DiscordTheme = "default" | "dark" | "onyx" | "light";

const discordThemes: Record<DiscordTheme, CSSProperties> = {
  default: {
    ["--bg" as string]: "oklab(0.303553 0.00292034 -0.0103036)",
    ["--embed-bg" as string]: "oklab(0.339495 0.00330827 -0.0116803)",
    ["--embed-border" as string]: "oklab(0.678888 0.00325716 -0.011175 / 0.2)",
    ["--embed-site-name" as string]: "oklab(0.883042 0.00118408 -0.00389016)",
    ["--embed-link" as string]: "oklab(0.74783 -0.0289609 -0.111271)",
    ["--embed-text" as string]: "oklab(0.883042 0.00118408 -0.00389016)",
  },
  dark: {
    ["--bg" as string]: "oklab(0.219499 0.00211129 -0.00744916)",
    ["--embed-bg" as string]: "oklab(0.262384 0.00252247 -0.00889932)",
    ["--embed-border" as string]: "oklab(0.678888 0.00325716 -0.011175 / 0.121569)",
    ["--embed-site-name" as string]: "oklab(0.952331 0.000418991 -0.00125992)",
    ["--embed-link" as string]: "oklab(0.670158 -0.038477 -0.141411)",
    ["--embed-text" as string]: "oklab(0.952331 0.000418991 -0.00125992)",
  },
  onyx: {
    ["--bg" as string]: "oklab(0.129689 0.00136997 -0.00485864)",
    ["--embed-bg" as string]: "oklab(0.190993 -0.000410579 -0.0043043)",
    ["--embed-border" as string]: "oklab(0.678888 0.00325716 -0.011175 / 0.239216)",
    ["--embed-site-name" as string]: "oklab(0.694913 0.00284365 -0.00970763)",
    ["--embed-link" as string]: "oklab(0.623584 -0.0424406 -0.161664)",
    ["--embed-text" as string]: "oklab(0.894999 0.000801653 -0.00257665)",
  },
  light: {
    ["--bg" as string]: "oklab(0.988044 0.0000450313 0.0000197887)",
    ["--embed-bg" as string]: "oklab(0.999994 0.0000455678 0.0000200868)",
    ["--embed-border" as string]: "oklab(0.678888 0.00325716 -0.011175 / 0.278431)",
    ["--embed-site-name" as string]: "oklab(0.335195 0.00285903 -0.0100273)",
    ["--embed-link" as string]: "oklab(0.569301 -0.0479858 -0.183635)",
    ["--embed-text" as string]: "oklab(0.335195 0.00285903 -0.0100273)",
  },
};

export function DiscordPreview({ data }: { data: SeoPreviewData }) {
  const [theme, setTheme] = useState<DiscordTheme>("default");

  const accentColor = isValidHex(data.themeColor) ? data.themeColor : undefined;
  const isLarge = data.twitterCard === "summary_large_image";
  const title = data.title || "Page Title";
  const description = data.description || "Page description will appear here.";
  const siteName = data.siteName || (data.siteUrl ? new URL(data.siteUrl.startsWith("http") ? data.siteUrl : `https://${data.siteUrl}`).hostname.replace("www.", "") : "Site Name");

  const vars = {
    ...discordThemes[theme],
    ["--embed-border-left" as string]: accentColor ?? `var(--embed-border)`,
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div
        className="w-full flex flex-col rounded-lg overflow-hidden p-10"
        style={{ backgroundColor: "var(--bg)", ...vars }}
      >
        <div
          className="border border-[color:var(--embed-border)] rounded-[0.25rem] grid max-w-max"
          style={{
            backgroundColor: "var(--embed-bg)",
            borderLeftColor: "var(--embed-border-left)",
            borderLeftWidth: "0.25rem",
          }}
        >
          <div
            className="pt-2 pr-4 pb-4 pl-3 grid max-w-[27rem]"
            style={{ gridTemplateColumns: "auto min-content" }}
          >
            {siteName && (
              <div className="mt-2 col-[1/1] text-[.75rem] font-normal leading-4" style={{ color: "var(--embed-site-name)" }}>
                {siteName}
              </div>
            )}
            <div className="mt-2 col-[1/1] break-words min-w-0">
              <span className="text-[1rem] font-semibold leading-[1.375rem] min-w-0 line-clamp-2" style={{ color: "var(--embed-link)" }}>
                {title.length > 67 ? title.slice(0, 67) + "…" : title}
              </span>
            </div>
            <div className="mt-2 col-[1/1] text-[0.875rem] font-normal leading-[1.125rem] whitespace-pre-wrap break-words min-w-0" style={{ color: "var(--embed-text)" }}>
              {(description.length > 347 ? description.slice(0, 347) + "…" : description)}
            </div>
            {data.imageUrl && !isLarge && (
              <div className="row-[1/8] col-[2/2] ml-4 mt-2 max-w-20 max-h-20 flex rounded-[0.25rem] overflow-hidden">
                <SafeImg src={data.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            {data.imageUrl && isLarge && (
              <div className="col-[1/1] mt-4 w-full rounded-[0.25rem] overflow-hidden">
                <SafeImg src={data.imageUrl} alt="" className="max-w-full w-full max-h-[300px] object-cover" />
              </div>
            )}
          </div>
        </div>
      </div>
      <ThemeSwitcher
        value={theme}
        onChange={setTheme}
        options={[
          { key: "default", icon: <IconDarkMode /> },
          { key: "dark", icon: <IconNight /> },
          { key: "onyx", icon: <IconCloud /> },
          { key: "light", icon: <IconLightMode /> },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google Preview
// ---------------------------------------------------------------------------

type GoogleTheme = "default" | "dark";

const googleThemes: Record<GoogleTheme, CSSProperties> = {
  default: {
    ["--bg" as string]: "#ffffff",
    ["--text-site-name" as string]: "#202124",
    ["--text-url" as string]: "#4d5156",
    ["--text-desc" as string]: "#474747",
    ["--accent" as string]: "#1a0dab",
    ["--border" as string]: "#dadce0",
    ["--icon-web" as string]: "#1a0dab",
    ["--icon-menu" as string]: "#4d5156",
  },
  dark: {
    ["--bg" as string]: "#101218",
    ["--text-site-name" as string]: "#dadce0",
    ["--text-url" as string]: "#bdc1c6",
    ["--text-desc" as string]: "#cdcdcd",
    ["--accent" as string]: "#7eaaff",
    ["--border" as string]: "#9aa0a6",
    ["--icon-web" as string]: "#697988",
    ["--icon-menu" as string]: "#9aa0a6",
  },
};

function NoFaviconIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...p}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  );
}

function DotsMenuIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...p}>
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

export function GooglePreview({ data }: { data: SeoPreviewData }) {
  const [theme, setTheme] = useState<GoogleTheme>("default");
  const [faviconErr, setFaviconErr] = useState(false);

  const vars = googleThemes[theme];

  const rawUrl = data.siteUrl || "https://example.com";
  const safeUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  let origin = "example.com";
  let pathParts: string[] = [];
  try {
    const u = new URL(safeUrl);
    origin = u.origin;
    pathParts = u.pathname.split("/").filter(Boolean);
  } catch {}

  const siteName = data.siteName || origin.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const title = data.title || "Page Title";
  const description = data.description || "A short description shown in search engine results.";

  const faviconUrl = data.siteUrl
    ? `${safeUrl.replace(/\/$/, "")}/favicon.ico`
    : null;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div
        className="w-full flex flex-col rounded-lg overflow-hidden p-10"
        style={{ backgroundColor: "var(--bg)", fontFamily: "Arial, sans-serif", ...vars }}
      >
        <div className="relative flex flex-col justify-start text-sm font-normal leading-[1.58]">
          <div className="basis-full grow shrink min-w-0">
            <div className="flex flex-col-reverse leading-[1.3]">
              <h3 className="mt-1 pt-1 text-xl line-clamp-1" style={{ color: "var(--accent)", fontWeight: 400 }}>
                {title}
              </h3>
              <div className="max-w-[calc(100%-20px)] flex w-full">
                <div className="flex items-center overflow-hidden">
                  <div className="mr-3 inline-block">
                    <div
                      className="w-[26px] h-[26px] bg-white rounded-full overflow-clip flex items-center justify-center border"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {faviconUrl && !faviconErr ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={faviconUrl}
                          alt=""
                          className="w-[18px] h-[18px]"
                          onError={() => setFaviconErr(true)}
                        />
                      ) : (
                        <NoFaviconIcon className="w-[18px] h-[18px]" style={{ fill: "var(--icon-web)" }} />
                      )}
                    </div>
                  </div>
                  <div className="overflow-hidden max-w-[22rem]">
                    <div className="leading-[20px] line-clamp-1" style={{ color: "var(--text-site-name)" }}>
                      {siteName}
                    </div>
                    <div className="text-[12px] line-clamp-1" style={{ color: "var(--text-url)" }}>
                      {origin}
                      {pathParts.length > 0 && (
                        <span> › {pathParts.join(" › ")}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="self-end ml-2 translate-y-0.5">
                  <DotsMenuIcon className="w-[18px] h-[18px]" style={{ fill: "var(--icon-menu)" }} />
                </div>
              </div>
            </div>
          </div>
          <div className="basis-full shrink grow">
            <div className="line-clamp-2 overflow-hidden text-sm font-normal" style={{ color: "var(--text-desc)" }}>
              {description}
            </div>
          </div>
        </div>
      </div>
      <ThemeSwitcher
        value={theme}
        onChange={setTheme}
        options={[
          { key: "default", icon: <IconLightMode /> },
          { key: "dark", icon: <IconDarkMode /> },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Twitter / X Preview
// ---------------------------------------------------------------------------

type TwitterTheme = "default" | "dim" | "dark";

const twitterThemes: Record<TwitterTheme, CSSProperties> = {
  default: {
    ["--bg" as string]: "white",
    ["--border" as string]: "rgb(207, 217, 222)",
    ["--image-noimg-bg" as string]: "rgb(247, 249, 249)",
    ["--image-noimg-fill" as string]: "rgb(83, 100, 113)",
    ["--text-title" as string]: "rgb(15, 20, 25)",
    ["--text-description" as string]: "rgb(83, 100, 113)",
  },
  dim: {
    ["--bg" as string]: "rgb(21, 32, 43)",
    ["--border" as string]: "rgb(56, 68, 77)",
    ["--image-noimg-bg" as string]: "rgb(30, 39, 50)",
    ["--image-noimg-fill" as string]: "rgb(139, 152, 165)",
    ["--text-title" as string]: "rgb(247, 249, 249)",
    ["--text-description" as string]: "rgb(139, 152, 165)",
  },
  dark: {
    ["--bg" as string]: "black",
    ["--border" as string]: "rgb(47, 51, 54)",
    ["--image-noimg-bg" as string]: "rgb(22, 24, 28)",
    ["--image-noimg-fill" as string]: "rgb(113, 118, 123)",
    ["--text-title" as string]: "rgb(231, 233, 234)",
    ["--text-description" as string]: "rgb(113, 118, 123)",
  },
};

function NoImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[2em] select-none max-w-full" style={{ fill: "var(--image-noimg-fill)" }}>
      <g>
        <path d="M1.998 5.5c0-1.38 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.12 2.5 2.5v13c0 1.38-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.12-2.5-2.5v-13zm2.5-.5c-.276 0-.5.22-.5.5v13c0 .28.224.5.5.5h15c.276 0 .5-.22.5-.5v-13c0-.28-.224-.5-.5-.5h-15zM6 7h6v6H6V7zm2 2v2h2V9H8zm10 0h-4V7h4v2zm0 4h-4v-2h4v2zm-.002 4h-12v-2h12v2z" />
      </g>
    </svg>
  );
}

export function TwitterPreview({ data }: { data: SeoPreviewData }) {
  const [theme, setTheme] = useState<TwitterTheme>("default");

  const isLarge = data.twitterCard === "summary_large_image";
  const title = data.title || "Page Title";
  const description = data.description || "Page description will appear here.";
  const vars: CSSProperties = {
    ...twitterThemes[theme],
    ["--overlay-text" as string]: "white",
    ["--overlay-bg" as string]: "rgba(0, 0, 0, 0.77)",
  };

  let domain = "example.com";
  try {
    const raw = data.siteUrl || "https://example.com";
    domain = new URL(raw.startsWith("http") ? raw : `https://${raw}`).host.replace("www.", "");
  } catch {}

  const switcher = (
    <ThemeSwitcher
      value={theme}
      onChange={setTheme}
      options={[
        { key: "default", icon: <IconLightMode /> },
        { key: "dim", icon: <IconPartlyCloudy /> },
        { key: "dark", icon: <IconDarkMode /> },
      ]}
    />
  );

  if (isLarge) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="w-full flex flex-col rounded-lg overflow-hidden p-10 items-center" style={{ backgroundColor: "var(--bg)", ...vars }}>
          <div className="flex flex-col gap-y-1 max-w-[32.375rem] w-full leading-5 font-sans font-normal" style={{ WebkitFontSmoothing: "subpixel-antialiased" }}>
            <div className="rounded-2xl relative border overflow-hidden" style={{ aspectRatio: "120/63", borderColor: "var(--border)" }}>
              {data.imageUrl ? (
                <SafeImg src={data.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "var(--image-noimg-bg)" }}>
                  <NoImageIcon />
                </div>
              )}
              <div
                className="absolute bottom-3 left-3 px-2 rounded-sm line-clamp-1 text-sm"
                style={{ backgroundColor: "var(--overlay-bg)", color: "var(--overlay-text)" }}
              >
                {title}
              </div>
            </div>
            <div className="text-[0.813rem]" style={{ color: "var(--text-description)" }}>
              From {domain}
            </div>
          </div>
        </div>
        {switcher}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="w-full flex flex-col rounded-lg overflow-hidden p-10 items-center" style={{ backgroundColor: "var(--bg)", ...vars }}>
        <div
          className="max-w-[32.375rem] h-[8.188rem] w-full rounded-2xl border flex overflow-hidden"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
        >
          <div
            className="w-[6.875rem] max-w-full border-r shrink-0 flex items-center justify-center"
            style={{
              borderColor: "var(--border)",
              backgroundColor: data.imageUrl ? undefined : "var(--image-noimg-bg)",
            }}
          >
            {data.imageUrl ? (
              <SafeImg src={data.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <NoImageIcon />
            )}
          </div>
          <div className="p-3 flex flex-col gap-0.5 justify-center font-sans text-[0.9375rem] leading-5 font-normal" style={{ WebkitFontSmoothing: "subpixel-antialiased" }}>
            <div style={{ color: "var(--text-description)" }}>{domain}</div>
            <div className="line-clamp-1" style={{ color: "var(--text-title)" }}>{title}</div>
            <div className="line-clamp-2" style={{ color: "var(--text-description)" }}>{description}</div>
          </div>
        </div>
      </div>
      {switcher}
    </div>
  );
}
