const { createApp, ref, watch, computed, onMounted, nextTick } = Vue;

createApp({
    setup() {
        const playlists = ref([]);
        const current = ref(0);
        const audioEl = ref(null);
        const isPlaying = ref(false);
        const currentTime = ref(0);
        const duration = ref(0);
        const progress = ref(0);
        let locked = false;
        const showLyrics = ref(false);

        // 把 lyrics 字符串按行拆成数组
        const lyricLines = Vue.computed(() => {
            const raw = playlists.value[current.value]?.lyrics || "";
            return raw.split("\n");
        });

        function openLyrics() {
            showLyrics.value = true;
            document.body.classList.add('lyrics-open');  

            // if (audioEl.value) audioEl.value.pause(); // 可选:打开歌词时暂停,想保持播放就删掉这行
        }
        function closeLyrics() {
            showLyrics.value = false;
            document.body.classList.remove('lyrics-open'); 
        }


        function loadAndPlay(autoplay = true) {
            const el = audioEl.value;
            if (!el || playlists.value.length === 0) return;
            el.src = "https://slkass.com/collections/static/" + playlists.value[current.value].symbal + ".mp3";
            el.load();
            if (autoplay) {
                el.play().catch(() => { isPlaying.value = false; });
            }
        }

        watch(current, () => {
            nextTick(() => loadAndPlay(true));
        });

        function changeSlide(direction) {
            if (locked) return;
            const next = current.value + direction;
            if (next < 0 || next >= playlists.value.length) return;
            locked = true;
            current.value = next;
            setTimeout(() => { locked = false; }, 900);
        }

        function goTo(idx) {
            if (locked || idx === current.value) return;
            locked = true;
            current.value = idx;
            setTimeout(() => { locked = false; }, 900);
        }

        let touchStartY = 0;
        // 工具函数:判断事件是否发生在可滚动的 reason 区域内
        function isInsideReason(e) {
            const reasonEl = e.target.closest('.reason');
            return reasonEl && reasonEl.scrollHeight > reasonEl.clientHeight;
        }

        function onWheel(e) {
            if (showLyrics.value) return;
            // 在长文案内滚动时,放行原生滚动,不翻页
            if (isInsideReason(e)) return;
            e.preventDefault();                 // 注意:见下方说明
            if (Math.abs(e.deltaY) < 10) return;
            changeSlide(e.deltaY > 0 ? 1 : -1);
        }

        function onTouchStart(e) {
            if (showLyrics.value) return;
            if (isInsideReason(e)) { touchStartY = null; return; } // 标记为"忽略翻页"
            touchStartY = e.touches[0].clientY;
        }

        function onTouchEnd(e) {
            if (showLyrics.value) return;
            if (touchStartY === null) return;   // 来自 reason 的滑动,跳过翻页
            const diff = touchStartY - e.changedTouches[0].clientY;
            if (Math.abs(diff) < 40) return;
            changeSlide(diff > 0 ? 1 : -1);
        }


        function togglePlay() {
            const el = audioEl.value;
            if (!el) return;
            if (el.paused) el.play().catch(() => { });
            else el.pause();
        }

        function onAudioError() {
            const song = playlists.value[current.value]?.song || "未知曲目";
            console.warn(`⚠️ 音频加载失败:${song}(可能文件损坏或链接失效)`);
            // 自动跳到下一首,避免卡在坏文件上
            if (current.value < playlists.value.length - 1) {
                changeSlide(1);
            }
        }


        function onTimeUpdate() {
            const el = audioEl.value;
            currentTime.value = el.currentTime;
            progress.value = el.duration ? (el.currentTime / el.duration) * 100 : 0;
        }

        function onLoaded() {
            duration.value = audioEl.value.duration;
        }

        function onEnded() {
            isPlaying.value = false;
            if (current.value < playlists.value.length - 1) {
                changeSlide(1);
            }
        }

        // 点击进度条跳转
        function seek(e) {
            const el = audioEl.value;
            if (!el || !el.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            el.currentTime = ratio * el.duration;
        }

        function formatTime(sec) {
            if (!sec || isNaN(sec)) return "0:00";
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60).toString().padStart(2, "0");
            return `${m}:${s}`;
        }

        onMounted(async () => {
            try {
                // 请确保 playlists.json 路径正确
                const response = await fetch('./playlists.json');
                if (!response.ok) {
                    throw new Error(`无法加载 playlists.json: ${response.status}`);
                }
                playlists.value = await response.json();

                nextTick(() => {
                    loadAndPlay(false);
                });
            } catch (error) {
                console.error("加载配置文件失败:", error);
            }
        });

        return {
            playlists, current, audioEl, isPlaying,
            currentTime, duration, progress,
            onWheel, onTouchStart, onTouchEnd, goTo,
            togglePlay, onTimeUpdate, onLoaded, onEnded, seek, formatTime,
            // 新增 ↓
            showLyrics, lyricLines, openLyrics, closeLyrics, onAudioError
        };

    }
}).mount("#app");
