"use client";

import { useState, useCallback } from "react";
import { ArrowUpDown, RotateCw, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { reorderPages, getPDFPageCount } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PageItem {
  id: string;
  originalIndex: number;
  rotation: number;
}

function PageThumbnail({
  item,
  onRotate,
  onDelete,
}: {
  item: PageItem;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div
        {...attributes}
        {...listeners}
        className="bg-white border border-gray-200 rounded-lg p-2 cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-sm transition-all aspect-[3/4] flex flex-col items-center justify-center relative touch-none"
      >
        <div
          className="w-full h-full flex items-center justify-center bg-gray-50 rounded"
          style={{ transform: `rotate(${item.rotation}deg)` }}
        >
          <span className="text-2xl font-bold text-gray-300">{item.originalIndex + 1}</span>
        </div>
        <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onRotate(item.id); }}
            className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
            aria-label="Rotate page"
          >
            <RotateCw className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="w-6 h-6 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors"
            aria-label="Delete page"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        <span className="absolute bottom-1 left-2 text-xs text-gray-400 group-hover:hidden">
          p. {item.originalIndex + 1}
        </span>
      </div>
    </div>
  );
}

export function ReorderPagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    try {
      const count = await getPDFPageCount(f);
      setPages(
        Array.from({ length: count }, (_, i) => ({
          id: `page-${i}`,
          originalIndex: i,
          rotation: 0,
        }))
      );
    } catch {
      toast.error("Could not read this PDF. It may be corrupted or password-protected.");
      setFile(null);
    }
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id);
        const newIndex = prev.findIndex((p) => p.id === over.id);
        const next = [...prev];
        const [removed] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, removed);
        return next;
      });
    }
  }

  function handleRotate(id: string) {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  }

  function handleDelete(id: string) {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }

  const handleExport = async () => {
    if (!file || pages.length === 0) return;
    setIsProcessing(true);
    try {
      const rotationsMap: Record<number, number> = {};
      pages.forEach((p) => { if (p.rotation !== 0) rotationsMap[p.originalIndex] = p.rotation; });
      const bytes = await reorderPages(file, pages.map((p) => p.originalIndex), rotationsMap);
      downloadFile(bytes, `${file.name.replace(/\.pdf$/i, "")}-reordered.pdf`);
      toast.success("PDF exported and downloaded!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export PDF.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Reorder Pages"
      description="Drag pages to reorder them. Rotate or delete individual pages before exporting."
    >
      <div className="space-y-6">
        {!file ? (
          <DropZone
            onDrop={handleDrop}
            accept={PDF_ACCEPT}
            multiple={false}
            label="Drop a PDF file here or click to browse"
          />
        ) : (
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
            <FileText className="w-5 h-5 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{pages.length} pages</p>
            </div>
            <button
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              onClick={() => { setFile(null); setPages([]); }}
            >
              Remove
            </button>
          </div>
        )}

        {pages.length > 0 && (
          <>
            <p className="text-xs text-gray-400">Drag to reorder · Hover to rotate or delete</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pages.map((p) => p.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {pages.map((page) => (
                    <PageThumbnail
                      key={page.id}
                      item={page}
                      onRotate={handleRotate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">{pages.length} page{pages.length !== 1 ? "s" : ""} remaining</p>
              <Button onClick={handleExport} disabled={isProcessing || pages.length === 0} className="gap-2">
                <ArrowUpDown className="w-4 h-4" />
                {isProcessing ? "Exporting…" : "Export PDF"}
              </Button>
            </div>
          </>
        )}
      </div>
    </ToolLayout>
  );
}
