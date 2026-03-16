
This ZIP contains only the files that need to be replaced or edited to enable reliable updates and consistent /AB/ scope.

FILES INCLUDED (drop-in replacements):
 - manifest.json (paths normalized to /AB/)
 - service-worker.js (static-only cache, no audio/API caching, auto-update)
 - Web.config (header Service-Worker-Allowed normalized to /AB/)

FILE TO EDIT IN PLACE (manual patch):
 - index.html: add the Service Worker registration snippet near the bottom, and fix the duplicated </script> in the tree-search line.

=== index.html PATCH ===
Insert this before </body>:

<script>
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/AB/service-worker.js", { scope: "/AB/" })
    .catch(err => console.error("SW reg failed:", err));
}
</script>

Fix the closing tag duplication:
Change from:
    <script src="tree-search.js?ver=1"></script></script>
To:
    <script src="tree-search.js?ver=1"></script>

(Optionally) Make sure your manifest link in <head> points to /AB/manifest.json and icons if not already.
