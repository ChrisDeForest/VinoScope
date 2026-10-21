import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { initAnalytics, trackPageview } from "../utils/analytics";

// One GA page view per page visited. Explore and the quizzes rewrite the query string as
// filters change, so only a new pathname counts; its query string at that moment is included.
export function usePageviews() {
  const { pathname, search } = useLocation();
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageview(`${pathname}${searchRef.current}`);
  }, [pathname]);
}
