"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelect, disabled }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setSelected(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      className={cn(
        "relative rounded-2xl border-2 border-dashed p-10 text-center transition-colors duration-200",
        dragActive
          ? "border-forta-primary bg-forta-primary-soft"
          : "border-forta-border bg-forta-muted/40 hover:border-forta-primary/40 hover:bg-forta-primary-soft/30",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input
        type="file"
        accept=".pdf,.txt,.doc,.docx,image/*"
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={disabled}
        aria-label="Upload referral letter"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {selected ? (
        <div className="flex items-center justify-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forta-primary-soft">
            <FileText className="h-7 w-7 text-forta-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-forta-primary-dark">{selected.name}</p>
            <p className="text-sm text-slate-500">{(selected.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelected(null);
            }}
            className="cursor-pointer rounded-full p-2 text-slate-400 transition-colors hover:bg-forta-border hover:text-slate-600"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-forta-primary-soft">
            <Upload className="h-7 w-7 text-forta-primary" />
          </div>
          <p className="mt-4 font-heading text-lg font-semibold text-forta-primary-dark">
            Drop referral letter here
          </p>
          <p className="mt-1 text-sm text-slate-500">PDF, Word, or image · max 20MB</p>
          <p className="mt-3 text-xs font-medium text-forta-primary">or click to browse</p>
        </>
      )}
    </div>
  );
}
