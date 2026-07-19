import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 256,
        fontWeight: 700,
        background: "#09090b",
        color: "#f59e0b",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      M
    </div>,
    { width: 512, height: 512 },
  );
}
