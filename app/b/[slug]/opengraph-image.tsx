import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getBlock } from "@/data/blocks";
import { buildVerdict, storyHeadline } from "@/pipeline/narrative";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "时间街道 TimeLayer 街区传记";

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const block = getBlock(slug);
  const font = await readFile(path.join(process.cwd(), "assets", "noto-serif-sc-og.otf"));

  if (!block) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#E6DFD3",
            color: "#26221C",
            fontSize: 48,
            fontFamily: "Noto Serif SC",
          }}
        >
          时间街道 TimeLayer
        </div>
      ),
      { ...size, fonts: [{ name: "Noto Serif SC", data: font, style: "normal", weight: 400 }] },
    );
  }

  const years = block.slices.map((s) => s.year).sort((a, b) => a - b);
  const latest = years[years.length - 1];
  const verdict = buildVerdict(block, years[0], latest);
  const { year, hook } = storyHeadline(block);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#E6DFD3",
          color: "#26221C",
          fontFamily: "Noto Serif SC",
          padding: "52px 56px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "22px 22px",
            border: "1px solid rgba(38,34,28,0.16)",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            paddingRight: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 17, letterSpacing: 4, color: "#6E6253" }}>
              {block.cityNameEn.toUpperCase()} · {block.borough} · 街区尺度
            </div>
            <div style={{ display: "flex", fontSize: 46, marginTop: 16, letterSpacing: 2 }}>
              {block.name}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 28,
              lineHeight: 1.85,
              color: "#26221C",
              maxWidth: 690,
              letterSpacing: 1,
            }}
          >
            {verdict}
          </div>

          <div style={{ display: "flex", fontSize: 16, letterSpacing: 3, color: "#6E6253" }}>
            {year} · {hook} · {years[0]}—{latest}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "space-between",
            width: 260,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 152,
              lineHeight: 1,
              letterSpacing: -4,
              color: "rgba(38,34,28,0.16)",
            }}
          >
            {year}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 7, color: "#26221C" }}>
              TIMELAYER
            </div>
            <div style={{ display: "flex", fontSize: 14, letterSpacing: 3, color: "#6E6253", marginTop: 8 }}>
              看看你的街区
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Noto Serif SC", data: font, style: "normal", weight: 400 }],
    },
  );
}
