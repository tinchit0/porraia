"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

export function TwemojiProvider() {
  const pathname = usePathname();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).twemoji?.parse(document.body, { folder: "svg", ext: ".svg" });
  }, [pathname, loaded]);

  return (
    <Script
      src="https://cdn.jsdelivr.net/npm/@twemoji/api@latest/dist/twemoji.min.js"
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onLoad={() => {
        setLoaded(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).twemoji.parse(document.body, { folder: "svg", ext: ".svg" });
      }}
    />
  );
}
