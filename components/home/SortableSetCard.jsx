"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableSetCard({ set }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: set.id });
  const primary = set.theme_primary || "#b9ff3c";
  const bg = set.theme_bg || "#050507";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
        position: "relative",
        background: `linear-gradient(135deg, ${bg} 0%, #050507 100%)`,
        borderRadius: 16,
        border: "1px solid var(--po-border)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
            color: "var(--po-text-faint)",
            flexShrink: 0,
            padding: "4px 0",
          }}
        >
          <GripVertical size={20} />
        </div>

        {set.logo_url ? (
          <img
            src={set.logo_url}
            alt={set.name}
            style={{ width: 48, height: 48, objectFit: "contain", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              background: primary,
              color: bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {set.code}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              lineHeight: 1.2,
              color: primary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {set.name}
          </div>
          {set.series && (
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--po-text-dim)",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {set.series}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
