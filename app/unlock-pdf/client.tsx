"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Loader2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

function fileBaseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function isLikelyPasswordError(message: string) {
  return /password|credential|authenticate|auth/i.test(message);
}

export function UnlockPDFClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isEncrypted, setIsEncrypted] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const canUnlock = useMemo(() => {
    if (!file) return false;
    if (isEncrypted === false) return false;
    return password.trim().length > 0;
  }, [file, isEncrypted, password]);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPassword("");
    setIsEncrypted(null);

    setIsInspecting(true);
    try {
      const { PDF } = await import("@libpdf/core");
      const bytes = new Uint8Array(await f.arrayBuffer());
      const pdf = await PDF.load(bytes);
      setIsEncrypted(Boolean(pdf.isEncrypted));
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or unsupported.");
      setFile(null);
      setIsEncrypted(null);
    } finally {
      setIsInspecting(false);
    }
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!file) return;
    if (isEncrypted === false) {
      toast.error("This PDF is not password-protected.");
      return;
    }
    if (!password.trim()) {
      toast.error("Enter the password to unlock this PDF.");
      return;
    }

    setIsProcessing(true);
    try {
      const { PDF, PermissionDeniedError } = await import("@libpdf/core");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await PDF.load(bytes, { credentials: password });

      try {
        pdf.removeProtection();
      } catch (err) {
        if (err instanceof PermissionDeniedError) {
          toast.error("Owner password required to remove protection. Try the owner password.");
          return;
        }
        throw err;
      }

      const out = await pdf.save();
      downloadFile(out, `${fileBaseName(file.name)}-unlocked.pdf`);
      toast.success("Unlocked PDF downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to unlock this PDF.";
      toast.error(isLikelyPasswordError(message) ? "Incorrect password for this PDF." : message);
    } finally {
      setIsProcessing(false);
    }
  }, [file, isEncrypted, password]);

  return (
    <ToolLayout
      title="Unlock PDF"
      description="Remove password protection from a PDF (when you know the password)."
    >
      <div className="space-y-6">
        {!file ? (
          <DropZone
            onDrop={handleDrop}
            accept={PDF_ACCEPT}
            multiple={false}
            label="Drop a password-protected PDF here or click to browse"
            sublabel="Everything runs locally in your browser."
          />
        ) : (
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
            <FileText className="w-5 h-5 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">
                {isInspecting
                  ? "Checking protection…"
                  : isEncrypted === false
                  ? "This PDF is not password-protected"
                  : "Enter the password to unlock"}
              </p>
            </div>
            <button
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              onClick={() => {
                setFile(null);
                setIsEncrypted(null);
                setPassword("");
              }}
            >
              Remove
            </button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-800">Unlock settings</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unlock-password">Password</Label>
            <Input
              id="unlock-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="User or owner password"
              autoComplete="current-password"
              disabled={!file || isEncrypted === false}
            />
            <p className="text-xs text-gray-400">
              If unlocking fails, you may need the <span className="font-medium text-gray-600">owner</span> password.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Tip: To add a password, use <span className="font-medium text-gray-600">Protect PDF</span>.
          </p>
          <Button onClick={handleUnlock} disabled={!canUnlock || isInspecting || isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Unlocking…
              </>
            ) : (
              "Unlock and download"
            )}
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}

