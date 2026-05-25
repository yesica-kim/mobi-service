"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Character } from "@/types";

interface Props {
  characters: Character[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (char: Character) => void;
  onReorder?: (oldIndex: number, newIndex: number) => void;
}

function SortableCharTab({
  char,
  active,
  onSelect,
  onEdit,
}: {
  char: Character;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: char.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative flex-shrink-0">
      {/* 드래그 핸들 */}
      <div
        {...attributes}
        {...listeners}
        className="mx-auto mb-0.5 flex h-7 w-12 items-center justify-center rounded-lg cursor-grab active:cursor-grabbing touch-none hover:bg-slate-800"
      >
        <svg className="w-5 h-4 text-slate-600" fill="currentColor" viewBox="0 0 24 12">
          <circle cx="6" cy="3" r="1.5" />
          <circle cx="12" cy="3" r="1.5" />
          <circle cx="18" cy="3" r="1.5" />
          <circle cx="6" cy="9" r="1.5" />
          <circle cx="12" cy="9" r="1.5" />
          <circle cx="18" cy="9" r="1.5" />
        </svg>
      </div>
      <button
        onClick={onSelect}
        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all min-w-[80px] relative ${
          active
            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
            : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
        }`}
      >
        <div className="text-[11px] opacity-70">{char.subClass}</div>
        <div className="font-bold">{char.name}</div>
        {active && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center hover:bg-slate-600 transition-colors"
            title="캐릭터 수정"
          >
            <svg className="w-2.5 h-2.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </button>
    </div>
  );
}

export function CharacterTabs({
  characters,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const oldIndex = characters.findIndex((c) => c.id === active.id);
    const newIndex = characters.findIndex((c) => c.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={characters.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide border-b border-slate-800/50">
          {characters.map((c) => (
            <SortableCharTab
              key={c.id}
              char={c}
              active={c.id === selectedId}
              onSelect={() => onSelect(c.id)}
              onEdit={() => onEdit(c)}
            />
          ))}
          <button
            onClick={onAdd}
            className="flex-shrink-0 rounded-xl border-2 border-dashed border-slate-600 px-5 py-2 text-sm font-semibold text-slate-400 transition-colors hover:border-blue-500 hover:text-blue-400 mt-[14px]"
          >
            + 캐릭터 추가
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}
