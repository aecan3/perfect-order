"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribes to Supabase Realtime postgres_changes on a single table,
 * server-side filtered, and calls onChange whenever a matching event fires.
 *
 * Lifecycle:
 *   - Subscribes when enabled becomes true (after auth resolves).
 *   - Tears down and re-subscribes if filter, channelName, or enabled changes.
 *   - Tears down on unmount.
 *
 * The hook owns no state. The consumer refetches in the onChange callback.
 */
export function useTableRefetch({
  supabase,
  table,
  events,
  filter,
  channelName,
  onChange,
  enabled = true,
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;

    let channel = supabase.channel(channelName);
    for (const event of events) {
      channel = channel.on(
        "postgres_changes",
        { event, schema: "public", table, filter },
        () => onChangeRef.current()
      );
    }
    channel.subscribe();

    return () => supabase.removeChannel(channel);
  }, [enabled, table, filter, channelName]);
}
