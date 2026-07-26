import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#09090b",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 292,
            height: 292,
            top: 81,
            left: 81,
            borderRadius: 64,
            background: "#059669",
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 292,
            height: 292,
            top: 139,
            left: 139,
            borderRadius: 64,
            backgroundImage: "linear-gradient(155deg, #34D399 0%, #6EE7B7 100%)",
          }}
        />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
