"use client";

import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { SortableSetCard } from "./SortableSetCard";

// Owns all dnd-kit usage for the home page so the library is code-split
// behind the lazy() import in app/page.js — visitors who never tap
// "Edit Order" don't download it.
export function ReorderSetList({ sets, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sets.findIndex((s) => s.id === active.id);
    const newIndex = sets.findIndex((s) => s.id === over.id);
    onReorder(arrayMove(sets, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {sets.map((set) => (
            <SortableSetCard key={set.id} set={set} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
