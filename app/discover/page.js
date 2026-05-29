"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getFriendIds } from "@/lib/queries/friends";
import { getBlockIds } from "@/lib/queries/blocks";
import { getDiscoverMatches } from "@/lib/queries/discover";
import { useTableRefetch } from "@/lib/hooks/useTableRefetch";
import { MSShell } from "@/components/chrome/MSShell";
import { MSPageTitle } from "@/components/chrome/MSPageTitle";
import { MarketplaceTile } from "@/components/marketplace/MarketplaceTile";
import { MarketplaceDetailOverlay } from "@/components/marketplace/MarketplaceDetailOverlay";
import { FriendDupeTile } from "@/components/marketplace/FriendDupeTile";
import { FriendDupeActionSheet } from "@/components/marketplace/FriendDupeActionSheet";
import { getUserMarketplaceId } from "@/lib/marketplace/currency-to-marketplace";

export default function DiscoverPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState(null);
  const [cards, setCards] = useState(null);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [activeMarketplaceListing, setActiveMarketplaceListing] = useState(null);
  const [activeFriendDupe, setActiveFriendDupe] = useState(null);

  const loadDiscover = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/welcome"); return; }
    if (!userId) setUserId(user.id);
    const [friendIds, blockIds] = await Promise.all([
      getFriendIds(supabase, user.id),
      getBlockIds(supabase, user.id),
    ]);
    const visibleFriendIds = friendIds.filter((id) => !blockIds.has(id));
    if (!visibleFriendIds.length) { setCards([]); return; }
    const results = await getDiscoverMatches({ supabase, viewerUserId: user.id, friendIds: visibleFriendIds });
    setCards(results);
  };

  useEffect(() => {
    loadDiscover();
  }, [router, supabase]);

  // Marketplace fetch runs in parallel with friend-dupe fetch — doesn't block
  // friend-dupe render. Uses the user's currency-derived marketplaceId for
  // multi-region support (AUD→EBAY_AU, USD→EBAY_US, etc.).
  useEffect(() => {
    const marketplaceId = getUserMarketplaceId();
    fetch(`/api/marketplace/listings?marketplaceId=${marketplaceId}`)
      .then((r) => r.json())
      .then((data) => setMarketplaceListings(data.listings || []))
      .catch((err) => console.error("[Discover] marketplace fetch failed:", err.message));
  }, []);

  useTableRefetch({
    supabase,
    table: "collection_entries",
    events: ["INSERT", "DELETE"],
    filter: `user_id=eq.${userId}`,
    channelName: `discover-page:${userId}`,
    onChange: loadDiscover,
    enabled: !!userId,
  });

  // Merge all friend dupes + marketplace listings, Fisher-Yates shuffle once
  // per data change. Memoised so overlay open/close doesn't reshuffle.
  const mergedTiles = useMemo(() => {
    const friendItems = (cards || []).map((d) => ({
      kind: "friend",
      payload: d,
      key: `friend-${d.printingId}-${d.friendHandle}`,
    }));
    const marketItems = marketplaceListings.map((l) => ({
      kind: "marketplace",
      payload: l,
      key: `market-${l.source}-${l.source_listing_id}`,
    }));
    const all = [...friendItems, ...marketItems];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, [cards, marketplaceListings]);

  return (
    <MSShell>
      <div className="pb-32">
        <MSPageTitle sub="Possible trades — cards your friends have as duplicates">
          Discover
        </MSPageTitle>

        <div className="px-4 py-4 max-w-md mx-auto space-y-4">
          {cards === null && (
            <div className="text-center text-[var(--po-text-dim)] text-sm py-16">Loading...</div>
          )}

          {cards !== null && cards.length === 0 && marketplaceListings.length === 0 && (
            <div className="text-center text-[var(--po-text-dim)] text-sm py-16">
              No matches yet — add friends and start collecting!
            </div>
          )}

          {/* Flat interleaved grid — friend-dupe tiles and marketplace tiles shuffled together */}
          {mergedTiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {mergedTiles.map((item) =>
                item.kind === "friend" ? (
                  <FriendDupeTile
                    key={item.key}
                    dupe={item.payload}
                    onTap={(d) => setActiveFriendDupe(d)}
                  />
                ) : (
                  <MarketplaceTile
                    key={item.key}
                    listing={item.payload}
                    onTap={(l) => setActiveMarketplaceListing(l)}
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>

      {activeFriendDupe && (
        <FriendDupeActionSheet
          dupe={activeFriendDupe}
          onClose={() => setActiveFriendDupe(null)}
        />
      )}

      {activeMarketplaceListing && (
        <MarketplaceDetailOverlay
          listing={activeMarketplaceListing}
          onClose={() => setActiveMarketplaceListing(null)}
        />
      )}
    </MSShell>
  );
}
