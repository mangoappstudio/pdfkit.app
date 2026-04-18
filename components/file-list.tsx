"use client";

import { X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface FileItem {
  id: string;
  file: File;
}

interface FileListProps {
  items: FileItem[];
  onRemove: (id: string) => void;
  onReorder: (ids: string[]) => void;
  icon?: React.ReactNode;
}

function SortableItem({
  item,
  onRemove,
  icon,
}: {
  item: FileItem;
  onRemove: (id: string) => void;
  icon?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sizeKB = (item.file.size / 1024).toFixed(0);
  const sizeMB = (item.file.size / 1024 / 1024).toFixed(1);
  const displaySize = item.file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      {icon && <span className="text-gray-400">{icon}</span>}
      <span className="flex-1 text-sm text-gray-800 truncate">{item.file.name}</span>
      <span className="text-xs text-gray-400 shrink-0">{displaySize}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(item.id)}
        aria-label={`Remove ${item.file.name}`}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export function FileList({ items, onRemove, onReorder, icon }: FileListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const newOrder = [...items];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);
      onReorder(newOrder.map((i) => i.id));
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableItem key={item.id} item={item} onRemove={onRemove} icon={icon} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
