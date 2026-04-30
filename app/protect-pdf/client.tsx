"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";

type ProtectionAlgorithm = "AES-256" | "AES-128" | "RC4-128" | "RC4-40";

type PdfPermissions = {
  print: boolean;
  printHighQuality: boolean;
  copy: boolean;
  modify: boolean;
  annotate: boolean;
  fillForms: boolean;
  accessibility: boolean;
  assemble: boolean;
};

const DEFAULT_PERMISSIONS: PdfPermissions = {
  print: true,
  printHighQuality: true,
  copy: true,
  modify: true,
  annotate: true,
  fillForms: true,
  accessibility: true,
  assemble: true,
};

const PERMISSION_LABELS: Array<{ key: keyof PdfPermissions; label: string; help: string }> = [
  { key: "print", label: "Allow printing", help: "Users can print the document." },
  { key: "printHighQuality", label: "Allow high-quality printing", help: "Enable high-resolution printing." },
  { key: "copy", label: "Allow copying", help: "Users can copy text/images from the document." },
  { key: "modify", label: "Allow modifications", help: "Users can edit the document content." },
  { key: "annotate", label: "Allow annotations", help: "Users can add comments/annotations." },
  { key: "fillForms", label: "Allow form filling", help: "Users can fill interactive form fields." },
  { key: "accessibility", label: "Allow accessibility access", help: "Enable screen readers and accessibility features." },
  { key: "assemble", label: "Allow page assembly", help: "Users can insert, rotate, or reorder pages in some viewers." },
];

function fileBaseName(name: string) {
  return name.replace(/\.pdf$/i, "") || "document";
}

function isLikelyPasswordError(message: string) {
  return /password|credential|authenticate|auth/i.test(message);
}

export function ProtectPDFClient() {
  const [file, setFile] = useState<File | null>(null);
  const [requiresCurrentPassword, setRequiresCurrentPassword] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [confirmUserPassword, setConfirmUserPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [algorithm, setAlgorithm] = useState<ProtectionAlgorithm>("AES-256");
  const [permissions, setPermissions] = useState<PdfPermissions>(DEFAULT_PERMISSIONS);

  const canSubmit = useMemo(() => {
    if (!file) return false;
    if (!userPassword.trim()) return false;
    if (userPassword !== confirmUserPassword) return false;
    if (requiresCurrentPassword && !currentPassword.trim()) return false;
    return true;
  }, [file, userPassword, confirmUserPassword, requiresCurrentPassword, currentPassword]);

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setRequiresCurrentPassword(false);
    setCurrentPassword("");
    setUserPassword("");
    setConfirmUserPassword("");
    setOwnerPassword("");
    setAlgorithm("AES-256");
    setPermissions(DEFAULT_PERMISSIONS);

    setIsInspecting(true);
    try {
      const { PDF } = await import("@libpdf/core");
      const bytes = new Uint8Array(await f.arrayBuffer());
      const pdf = await PDF.load(bytes);
      setRequiresCurrentPassword(Boolean(pdf.isEncrypted && !pdf.isAuthenticated));
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or unsupported.");
      setFile(null);
      setRequiresCurrentPassword(false);
    } finally {
      setIsInspecting(false);
    }
  }, []);

  const handleProtect = useCallback(async () => {
    if (!file) return;
    if (!userPassword.trim()) {
      toast.error("Enter a password to protect this PDF.");
      return;
    }
    if (userPassword !== confirmUserPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (requiresCurrentPassword && !currentPassword.trim()) {
      toast.error("Enter the current password to modify this protected PDF.");
      return;
    }

    setIsProcessing(true);
    try {
      const { PDF } = await import("@libpdf/core");
      const bytes = new Uint8Array(await file.arrayBuffer());

      const pdf = requiresCurrentPassword
        ? await PDF.load(bytes, { credentials: currentPassword })
        : await PDF.load(bytes);

      pdf.setProtection({
        userPassword: userPassword,
        ownerPassword: ownerPassword.trim() ? ownerPassword.trim() : undefined,
        algorithm,
        permissions,
      });

      const out = await pdf.save();
      downloadFile(out, `${fileBaseName(file.name)}-protected.pdf`);
      toast.success("Protected PDF downloaded!");
    } catch (err) {
      if (err instanceof Error && err.name === "PermissionDeniedError") {
        toast.error("Owner access required to change protection. Try the owner password.");
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to protect this PDF.";
      toast.error(isLikelyPasswordError(message) ? "Incorrect password for this PDF." : message);
    } finally {
      setIsProcessing(false);
    }
  }, [
    file,
    userPassword,
    confirmUserPassword,
    ownerPassword,
    algorithm,
    permissions,
    requiresCurrentPassword,
    currentPassword,
  ]);

  return (
    <ToolLayout
      title="Protect PDF"
      description="Add password protection and optional permissions to a PDF."
    >
      <div className="space-y-6">
        {!file ? (
          <DropZone
            onDrop={handleDrop}
            accept={PDF_ACCEPT}
            multiple={false}
            label="Drop a PDF file here or click to browse"
            sublabel="Everything runs locally in your browser."
          />
        ) : (
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
            <FileText className="w-5 h-5 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">
                {isInspecting ? "Checking protection…" : requiresCurrentPassword ? "Password required to modify this PDF" : "Ready to protect"}
              </p>
            </div>
            <button
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              onClick={() => {
                setFile(null);
                setRequiresCurrentPassword(false);
                setCurrentPassword("");
              }}
            >
              Remove
            </button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-800">Protection settings</h2>
          </div>

          {requiresCurrentPassword && (
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Required to modify this PDF"
                autoComplete="current-password"
              />
              <p className="text-xs text-gray-400">
                If this PDF is already protected, enter the existing user or owner password to update it.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="user-password">Password (required)</Label>
            <Input
              id="user-password"
              type="password"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              placeholder="Required to open the PDF"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-user-password">Confirm password</Label>
            <Input
              id="confirm-user-password"
              type="password"
              value={confirmUserPassword}
              onChange={(e) => setConfirmUserPassword(e.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
            {userPassword && confirmUserPassword && userPassword !== confirmUserPassword && (
              <p className="text-xs text-red-600">Passwords do not match.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner-password">
              Owner password <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="owner-password"
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              placeholder="Grants full access (recommended)"
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-400">
              The owner password can bypass permission restrictions and is often required to remove protection later.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="algorithm">Encryption algorithm</Label>
            <select
              id="algorithm"
              className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as ProtectionAlgorithm)}
            >
              <option value="AES-256">AES-256 (recommended)</option>
              <option value="AES-128">AES-128</option>
              <option value="RC4-128">RC4-128 (legacy)</option>
              <option value="RC4-40">RC4-40 (legacy, weak)</option>
            </select>
            {algorithm.startsWith("RC4") && (
              <p className="text-xs text-amber-600">RC4 is legacy and not recommended for sensitive documents.</p>
            )}
          </div>

          <details className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-800">
              Advanced permissions
            </summary>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PERMISSION_LABELS.map(({ key, label, help }) => (
                <label key={key} className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    checked={permissions[key]}
                    onChange={(e) =>
                      setPermissions((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-gray-400">{help}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              PDF permissions are advisory and not enforced consistently across all PDF viewers.
            </p>
          </details>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Tip: To remove a password later, use <span className="font-medium text-gray-600">Unlock PDF</span>.
          </p>
          <Button onClick={handleProtect} disabled={!canSubmit || isInspecting || isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Protecting…
              </>
            ) : (
              "Protect and download"
            )}
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}
