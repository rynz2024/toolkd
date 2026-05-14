import React, { useCallback, useEffect, useRef, useState } from "react";

const api = typeof window !== "undefined" ? window.api : null;

export default function ImageDropzone({ label, hint, value, onChange }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return undefined;
    }
    // If we already have a preview URL from a previous step, use it.
    if (value.previewUrl) {
      setPreviewUrl(value.previewUrl);
      return undefined;
    }
    // Otherwise create one from the file path via file:// URL.
    setPreviewUrl(`file://${value.path}`);
    return undefined;
  }, [value]);

  const handleFile = useCallback(
    async (file) => {
      if (!file || !file.type?.startsWith("image/")) return;
      let filePath = api?.getPathForFile ? api.getPathForFile(file) : null;
      if (!filePath) {
        // Fallback: read the file and write it through IPC.
        const buffer = await file.arrayBuffer();
        filePath = await api.saveUploadedBuffer(file.name, buffer);
      }
      const url = URL.createObjectURL(file);
      onChange({ path: filePath, name: file.name, previewUrl: url });
    },
    [onChange],
  );

  const handleBrowse = async () => {
    if (api?.pickImage) {
      const picked = await api.pickImage();
      if (picked) {
        onChange({ path: picked, name: picked.split(/[\\/]/).pop() });
      }
      return;
    }
    inputRef.current?.click();
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onClick={handleBrowse}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`relative cursor-pointer rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center px-2 py-2 transition-colors h-full min-h-[160px] ${
        isDragOver
          ? "border-accent bg-accent/10"
          : "border-surface-border bg-surface-elevated hover:border-accent/60"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={label}
          className="absolute inset-1 w-[calc(100%-0.5rem)] h-[calc(100%-0.5rem)] object-cover rounded"
        />
      ) : (
        <>
          <span className="text-3xl mb-1">📷</span>
          <span className="text-xs text-gray-400">{hint}</span>
        </>
      )}
      <span className="absolute top-1 left-1 bg-black/60 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded">
        {label}
      </span>
    </div>
  );
}
