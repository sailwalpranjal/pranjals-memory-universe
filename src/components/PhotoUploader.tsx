"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  Loader2,
  CheckCircle2,
  Film,
  Music,
  Image as ImageIcon,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: "image" | "video" | "audio" | "other";
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  previewUrl?: string;
}

export default function PhotoUploader({
  onUploadSuccess,
}: {
  onUploadSuccess?: () => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getMediaType = (mime: string): UploadItem["type"] => {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "other";
  };

  const addFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => {
      if (f.size > 4.5 * 1024 * 1024) {
        alert("File " + f.name + " exceeds 4.5MB limit. Vercel serverless functions have a 4.5MB payload limit. Video uploads require a direct-to-storage architecture.");
        return false;
      }
      return true;
      });
      const newItems: UploadItem[] = validFiles.map((f) => ({
      id: Math.random().toString(36).substring(2, 9),
      file: f,
      name: f.name,
      size: f.size,
      type: getMediaType(f.type),
      status: "pending",
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
    }));

    setItems((prev) => [...prev, ...newItems]);
    // Automatically trigger upload
    uploadBatch(newItems);
  };

  const uploadSingle = async (item: UploadItem): Promise<boolean> => {
    const formData = new FormData();
    formData.append("file", item.file);

    try {
      // Facial extraction and voice identification is natively handled by Gemini Multimodal AI on the server (/api/upload).
      // No client-side heavy lifting is required.

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed with status ${res.status}`);
      }

      return true;
    } catch (err: unknown) {
      console.warn("[PhotoUploader] upload error:", err);
      return false;
    }
  };

  const uploadBatch = async (batchItems: UploadItem[]) => {
    setIsUploading(true);
    let anySuccess = false;

    for (const item of batchItems) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "uploading" } : i))
      );

      const success = await uploadSingle(item);

      if (success) {
        anySuccess = true;
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "done" } : i))
        );
      } else {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "error", error: "Upload failed" } : i
          )
        );
      }
    }

    setIsUploading(false);
    if (anySuccess && onUploadSuccess) {
      onUploadSuccess();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // Reset file input so re-selecting same file works
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="w-full space-y-4">
      {/* Drop Zone */}
      <div
        className={cn(
          "relative flex flex-col items-center justify-center w-full min-h-48 p-6 border-2 border-dashed rounded-3xl transition-all cursor-pointer bg-zinc-950/40 select-none",
          dragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-white/10 hover:border-white/20 hover:bg-zinc-900/40",
          isUploading && "cursor-wait"
        )}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          className="hidden"
          onChange={handleChange}
        />

        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-muted-foreground">
            {isUploading ? (
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            ) : (
              <UploadCloud className="w-7 h-7 text-foreground" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {isUploading ? "Uploading media to your Universe..." : "Choose files or drag & drop"}
            </p>
            <p className="text-xs text-muted-foreground">
              High-resolution Photos, 4K Videos, and Audio Voice Memos (Multiple files supported)
            </p>
          </div>

          <div className="flex items-center space-x-4 pt-1 text-[11px] text-muted-foreground/60">
            <span className="flex items-center space-x-1">
              <ImageIcon className="w-3 h-3 text-primary/70" />
              <span>JPG, PNG, WEBP, HEIC</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <Film className="w-3 h-3 text-sky-400/70" />
              <span>MP4, MOV, WEBM</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <Music className="w-3 h-3 text-emerald-400/70" />
              <span>MP3, WAV, M4A</span>
            </span>
          </div>
        </div>
      </div>

      {/* Batch Upload Progress Items */}
      {items.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto p-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-white/5 text-xs"
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                {item.type === "image" && item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover shrink-0"
                  />
                ) : item.type === "video" ? (
                  <Film className="w-5 h-5 text-sky-400 shrink-0" />
                ) : item.type === "audio" ? (
                  <Music className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                )}

                <div className="truncate">
                  <p className="text-foreground font-medium truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(item.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {item.status === "uploading" && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                )}
                {item.status === "done" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                {item.status === "error" && (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                )}
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
