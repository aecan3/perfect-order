"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SetCardTile } from "./SetCardTile";

export function SortableSetCard({ set }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: set.id });

  return (
    <SetCardTile
      set={set}
      innerRef={setNodeRef}
      containerStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
      }}
      handleProps={{ ...attributes, ...listeners }}
      handleStyle={{ cursor: isDragging ? "grabbing" : "grab" }}
    />
  );
}
