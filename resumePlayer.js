// ================= resumePlayer.js =================
//
// Single authoritative playback / resume controller.
// Handles:
//  - src assignment (guarded)
//  - warm resume (play first, seek after)
//  - loading UI timing (hide ONLY when audio is real)
//

(function (global) {
    const player = document.getElementById("player");

    if (!player) {
        console.error("ResumePlayer: #player not found");
        return;
    }

    let lastSrc = null;

    function play({ src, position = 0, onPlay }) {
        // ---- GUARD: do NOT reassign src if identical ----
        if (player.src !== src) {
            player.src = src;
            lastSrc = src;
        }

        const resumePos =
            typeof position === "number" && position > 0 ? position : 0;

        // ---- SHOW loading immediately ----
        if (typeof showLoading === "function") {
            showLoading("Loading…");
        }
        if (typeof disablePlayerControls === "function") {
            disablePlayerControls();
        }

        // ---- STEP 1: start playback as soon as browser allows ----
        const onCanPlay = () => {
            const p = player.play();
            if (p && typeof p.catch === "function") {
                p.catch(() => { });
            }
        };

        // ---- STEP 2: WARM resume + correct loader hiding ----
        const onPlaying = () => {
            // Apply resume seek ONLY after playback begins (warm decoder)
            if (resumePos > 0) {
                player.currentTime = resumePos;
            }

            // Hide loader ONLY when audio actually advances
            const onFirstFrame = () => {
                if (typeof hideLoading === "function") {
                    hideLoading();
                }
                if (typeof enablePlayerControls === "function") {
                    enablePlayerControls();
                }

                player.removeEventListener("timeupdate", onFirstFrame);

                if (typeof onPlay === "function") {
                    onPlay();
                }
            };

            player.addEventListener("timeupdate", onFirstFrame);
        };

        player.addEventListener("canplay", onCanPlay, { once: true });
        player.addEventListener("playing", onPlaying, { once: true });
    }

    // Public API
    global.ResumePlayer = {
        play
    };

})(window);