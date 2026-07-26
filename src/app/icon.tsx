import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#09090b",
          borderRadius: 7,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 18,
            height: 18,
            top: 5,
            left: 4,
            borderRadius: 4,
            background: "#059669",
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 18,
            height: 18,
            top: 9,
            left: 10,
            borderRadius: 4,
            background: "#34D399",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
