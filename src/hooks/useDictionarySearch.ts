import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import type { TimeSpent } from "@/hooks/useTimeSpent";
import { lookupWord } from "@/lib/dictionary.functions";

/**
 * Vocabulary dictionary search: debounced term, the context.reverso.net
 * lookup and the reading time it counts (paused a minute after the last key).
 */
export function useDictionarySearch(minutesSpent: TimeSpent) {
  const searchDictionary = useServerFn(lookupWord);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const q = term.trim();

  useEffect(() => {
    const id = setTimeout(() => setTerm(query), 450);
    return () => clearTimeout(id);
  }, [query]);

  // Time spent looking words up in the search field counts as reading practice,
  // but pauses one minute after the last keystroke.
  useEffect(() => {
    if (query.trim().length < 2) {
      minutesSpent.stop();
      return;
    }
    minutesSpent.start();
    const idle = setTimeout(() => minutesSpent.stop(), 60_000);
    return () => clearTimeout(idle);
  }, [query, minutesSpent]);

  const { data: entry, isFetching: searching } = useQuery({
    queryKey: ["dictionary-v2", q.toLowerCase()],
    queryFn: () => searchDictionary({ data: { term: q } }),
    enabled: q.length >= 2,
    staleTime: 1000 * 60 * 60,
  });

  return { query, setQuery, q, entry, searching };
}
