import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
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
            width: 103,
            height: 103,
            top: 29,
            left: 29,
            borderRadius: 23,
            background: "#059669",
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 103,
            height: 103,
            top: 49,
            left: 49,
            borderRadius: 23,
            backgroundImage: "linear-gradient(155deg, #34D399 0%, #6EE7B7 100%)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
