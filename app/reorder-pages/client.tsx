"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { ArrowUpDown, Check, GripVertical, RotateCw, Trash2, Undo2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ToolLayout } from "@/components/tool-layout";
import { DropZone } from "@/components/drop-zone";
import { Button } from "@/components/ui/button";
import { reorderPages, getPDFPageCount } from "@/lib/pdf-utils";
import { downloadFile } from "@/lib/download";
import { PDF_ACCEPT } from "@/lib/file-utils";
import { usePdfThumbnails } from "@/components/use-pdf-thumbnails";
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
  thumbnailUrl,
  selected,
  isRenderingThumbs,
  onRotate,
  onDelete,
  onSelect,
  onSelectRange,
}: {
  item: PageItem;
  thumbnailUrl: string | null;
  selected: boolean;
  isRenderingThumbs: boolean;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onSelectRange: (id: string) => void;
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
        className={`bg-white border-2 rounded-lg p-2 hover:shadow-sm transition-all aspect-[3/4] flex flex-col items-center justify-center relative ${
          selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <div
          className="w-full h-full flex items-center justify-center bg-gray-50 rounded overflow-hidden"
          style={{ transform: `rotate(${item.rotation}deg)` }}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`Page ${item.originalIndex + 1} preview`}
              className="w-full h-full object-contain bg-white"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isRenderingThumbs ? (
                <Loader2 className="w-4 h-4 text-gray-300 animate-spin" aria-hidden="true" />
              ) : (
                <span className="text-2xl font-bold text-gray-300">{item.originalIndex + 1}</span>
              )}
            </div>
          )}
        </div>
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) onSelectRange(item.id);
              else onSelect(item.id);
            }}
            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
              selected
                ? "bg-blue-600 border-blue-600 text-white"
                : "bg-white/90 border-gray-200 text-gray-400 hover:text-gray-600"
            }`}
            aria-label={selected ? "Deselect page" : "Select page"}
          >
            {selected ? <Check className="w-4 h-4" aria-hidden="true" /> : <span className="w-2 h-2 rounded-full bg-current opacity-30" />}
          </button>
          <button
            {...attributes}
            {...listeners}
            className="w-7 h-7 rounded bg-white/90 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors cursor-grab active:cursor-grabbing touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
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
  const [originalPageCount, setOriginalPageCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [undoCount, setUndoCount] = useState(0);
  const lastClickedIndexRef = useRef<number | null>(null);
  const undoStackRef = useRef<PageItem[][]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { urls: thumbUrls, isRendering: isRenderingThumbs, renderedCount: thumbsRendered, reset: resetThumbs } =
    usePdfThumbnails(file, originalPageCount, { width: 160, maxScale: 1, yieldEvery: 1 });

  const handleDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    resetThumbs();
    setFile(f);
    setSelectedIds(new Set());
    lastClickedIndexRef.current = null;
    undoStackRef.current = [];
    setUndoCount(0);
    try {
      const count = await getPDFPageCount(f);
      setOriginalPageCount(count);
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
      setOriginalPageCount(0);
    }
  }, [resetThumbs]);

  const selectedCount = selectedIds.size;
  const canUndo = undoCount > 0;

  const idToIndex = useMemo(() => new Map(pages.map((p, idx) => [p.id, idx])), [pages]);

  function pushUndo(snapshot: PageItem[]) {
    undoStackRef.current.push(snapshot.map((p) => ({ ...p })));
    setUndoCount(undoStackRef.current.length);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPages((prev) => {
        pushUndo(prev);
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
    setPages((prev) => {
      pushUndo(prev);
      return prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
    });
  }

  function handleDelete(id: string) {
    setPages((prev) => {
      pushUndo(prev);
      return prev.filter((p) => p.id !== id);
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastClickedIndexRef.current = idToIndex.get(id) ?? null;
  }

  function selectRangeTo(id: string) {
    const idx = idToIndex.get(id);
    const last = lastClickedIndexRef.current;
    if (idx === undefined || last === null) return toggleSelect(id);
    const start = Math.min(last, idx);
    const end = Math.max(last, idx);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) next.add(pages[i]!.id);
      return next;
    });
    lastClickedIndexRef.current = idx;
  }

  function clearSelection() {
    setSelectedIds(new Set());
    lastClickedIndexRef.current = null;
  }

  function rotateSelected() {
    if (selectedIds.size === 0) return;
    setPages((prev) => {
      pushUndo(prev);
      return prev.map((p) =>
        selectedIds.has(p.id) ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      );
    });
  }

  function deleteSelected() {
    if (selectedIds.size === 0) return;
    setPages((prev) => {
      pushUndo(prev);
      return prev.filter((p) => !selectedIds.has(p.id));
    });
    clearSelection();
  }

  function undo() {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    setPages(prev);
    clearSelection();
    setUndoCount(undoStackRef.current.length);
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
              <p className="text-xs text-gray-400">
                {pages.length} pages
                {isRenderingThumbs ? ` · rendering previews ${thumbsRendered}/${originalPageCount}` : ""}
              </p>
            </div>
            <button
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              onClick={() => {
                resetThumbs();
                setFile(null);
                setPages([]);
                setOriginalPageCount(0);
                clearSelection();
                undoStackRef.current = [];
                setUndoCount(0);
              }}
            >
              Remove
            </button>
          </div>
        )}

        {pages.length > 0 && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-400">
                Drag handle to reorder · Select pages for bulk actions
              </p>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo}>
                  <Undo2 className="w-4 h-4" />
                  Undo
                </Button>
                <Button size="sm" variant="outline" onClick={rotateSelected} disabled={selectedCount === 0}>
                  <RotateCw className="w-4 h-4" />
                  Rotate selected
                </Button>
                <Button size="sm" variant="outline" onClick={deleteSelected} disabled={selectedCount === 0}>
                  <Trash2 className="w-4 h-4" />
                  Delete selected
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection} disabled={selectedCount === 0}>
                  Clear selection
                </Button>
              </div>
            </div>

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
                      thumbnailUrl={thumbUrls[page.originalIndex] ?? null}
                      selected={selectedIds.has(page.id)}
                      isRenderingThumbs={isRenderingThumbs}
                      onRotate={handleRotate}
                      onDelete={handleDelete}
                      onSelect={toggleSelect}
                      onSelectRange={selectRangeTo}
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
