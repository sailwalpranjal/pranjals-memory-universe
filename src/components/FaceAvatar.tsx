"use client";

import React, { useEffect, useRef, useState } from "react";
import { User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BoundingBoxObject {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  _x?: number;
  _y?: number;
  _width?: number;
  _height?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  [key: string]: unknown;
}

export type BoundingBoxInput =
  | BoundingBoxObject
  | [number, number, number, number]
  | string
  | null
  | undefined;

export interface FaceAvatarProps {
  photoUrl?: string | null;
  box?: BoundingBoxInput;
  size?: number; // Target display size in pixels (default 80)
  className?: string;
  alt?: string;
  onClick?: () => void;
  showFallbackOnMissingBox?: boolean;
}

/**
 * Normalizes any bounding box format (face-api Box, JSON string, array, or coordinates)
 * into a standardized { x, y, width, height } object.
 */
export function normalizeBoundingBox(
  input: BoundingBoxInput
): { x: number; y: number; width: number; height: number } | null {
  if (!input) return null;

  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return null;
    }
  }

  if (Array.isArray(parsed) && parsed.length >= 4) {
    const [x, y, width, height] = parsed;
    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof width === "number" &&
      typeof height === "number" &&
      width > 0 &&
      height > 0
    ) {
      return { x, y, width, height };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const b = parsed as BoundingBoxObject;
    const x = b.x ?? b._x ?? b.left;
    const y = b.y ?? b._y ?? b.top;

    let width = b.width ?? b._width;
    if (width === undefined && b.right !== undefined && b.left !== undefined) {
      width = b.right - b.left;
    }

    let height = b.height ?? b._height;
    if (height === undefined && b.bottom !== undefined && b.top !== undefined) {
      height = b.bottom - b.top;
    }

    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof width === "number" &&
      typeof height === "number" &&
      width > 0 &&
      height > 0
    ) {
      return { x, y, width, height };
    }
  }

  return null;
}

export default function FaceAvatar({
  photoUrl,
  box,
  size = 80,
  className,
  alt = "Face portrait",
  onClick,
}: FaceAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    photoUrl ? "loading" : "error"
  );

  useEffect(() => {
    if (!photoUrl) {
      setStatus("error");
      return;
    }

    let isMounted = true;
    setStatus("loading");

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (!isMounted || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setStatus("error");
        return;
      }

      // High-DPI retina rendering (2x canvas scale)
      const scale = 2;
      canvas.width = size * scale;
      canvas.height = size * scale;

      const normBox = normalizeBoundingBox(box);

      if (normBox) {
        // Face detection bounding box present: calculate 1:1 square crop with 25-30% padding
        const padX = normBox.width * 0.25;
        const padY = normBox.height * 0.3;

        const rawW = normBox.width + padX * 2;
        const rawH = normBox.height + padY * 2;
        const side = Math.max(rawW, rawH);

        const centerX = normBox.x + normBox.width / 2;
        const centerY = normBox.y + normBox.height / 2;

        let sx = centerX - side / 2;
        let sy = centerY - side / 2;

        // Clamp crop bounds within image boundaries
        // Ensure square aspect ratio
        let finalSide = side;
        if (sx < 0) { finalSide += sx; sx = 0; }
        if (sy < 0) { finalSide += sy; sy = 0; }
        if (sx + finalSide > img.naturalWidth) { finalSide = img.naturalWidth - sx; }
        if (sy + finalSide > img.naturalHeight) { finalSide = img.naturalHeight - sy; }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, finalSide, finalSide, 0, 0, canvas.width, canvas.height);
      } else {
        // Fallback: square center crop of entire photo
        const minDim = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - minDim) / 2;
        const sy = (img.naturalHeight - minDim) / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, canvas.width, canvas.height);
      }

      setStatus("ready");
    };

    img.onerror = () => {
      if (isMounted) {
        setStatus("error");
      }
    };

    img.src = photoUrl;

    return () => {
      isMounted = false;
    };
  }, [photoUrl, box, size]);

  return (
    <div
      onClick={onClick}
      style={{ width: size, height: size }}
      className={cn(
        "relative flex-shrink-0 aspect-square rounded-full overflow-hidden bg-secondary/40 border border-border/50 shadow-sm transition-all select-none",
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary/50",
        className
      )}
      title={alt}
    >
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/30 backdrop-blur-xs">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/60" />
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/60 text-muted-foreground/50">
          <User className="w-1/2 h-1/2 opacity-60" />
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={cn(
          "w-full h-full object-cover",
          status !== "ready" && "invisible"
        )}
      />
    </div>
  );
}

export const FaceThumbnail = FaceAvatar;
