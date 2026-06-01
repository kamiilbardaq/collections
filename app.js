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

        // 1. 在 setup() 内部定义检测函数
        function checkStandaloneMode() {
            const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
            if (isStandalone) {
                document.body.classList.add('standalone-mode');
            } else {
                document.body.classList.remove('standalone-mode');
            }
            return isStandalone;
        }

        // ================= [修改] 抽离出来的初始化函数 =================
        function initInstallGuide() {
            const installBtn = document.getElementById('installBtn');
            const guideOverlay = document.getElementById('guideOverlay');
            const guideSheet = document.getElementById('guideSheet');
            const guideCloseBtn = document.getElementById('guideCloseBtn');

            if (!installBtn) return;

            // 使用刚才定义的方法
            const isStandalone = checkStandaloneMode();

            if (isStandalone) {
                installBtn.style.display = 'none';
                return;
            }

            // 点击 INSTALL 按钮
            installBtn.addEventListener('click', () => {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

                if (!isIOS) {
                    alert("提示：请在 iPhone 的 Safari 浏览器中打开此页面，即可添加到桌面。");
                    return;
                }

                if (guideOverlay && guideSheet) {
                    guideOverlay.classList.add('show');
                    guideSheet.classList.add('show');
                }
            });

            // 关闭弹窗
            function closeGuide() {
                if (guideOverlay) guideOverlay.classList.remove('show');
                if (guideSheet) guideSheet.classList.remove('show');
            }

            if (guideCloseBtn) guideCloseBtn.addEventListener('click', closeGuide);
            if (guideOverlay) guideOverlay.addEventListener('click', closeGuide);
        }
        //////////////////////////////////////////////

        // 把 lyrics 字符串按行拆成数组
        const lyricLines = Vue.computed(() => {
            const raw = playlists.value[current.value]?.lyrics || "";
            return raw.split("\n");
        });

        function openLyrics() {
            showLyrics.value = true;
            document.body.classList.add('lyrics-open');
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
        function isInsideReason(e) {
            const reasonEl = e.target.closest('.reason');
            return reasonEl && reasonEl.scrollHeight > reasonEl.clientHeight;
        }

        function onWheel(e) {
            if (showLyrics.value) return;
            if (isInsideReason(e)) return;
            e.preventDefault();
            if (Math.abs(e.deltaY) < 10) return;
            changeSlide(e.deltaY > 0 ? 1 : -1);
        }

        function onTouchStart(e) {
            if (showLyrics.value) return;
            if (isInsideReason(e)) { touchStartY = null; return; }
            touchStartY = e.touches[0].clientY;
        }

        function onTouchEnd(e) {
            if (showLyrics.value) return;
            if (touchStartY === null) return;
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
            checkStandaloneMode();
            try {
                // 1. 先加载数据
                const response = await fetch('./playlists.json');
                if (!response.ok) {
                    throw new Error(`无法加载 playlists.json: ${response.status}`);
                }
                playlists.value = await response.json();

                // 2. 等待 Vue 将数据完全渲染成 DOM（Loading 消失，Slider 出现）
                nextTick(() => {
                    loadAndPlay(false);

                    // 3. 此时 DOM 已经绝对稳定，在这里绑定事件，万无一失！
                    initInstallGuide();
                });
            } catch (error) {
                console.error("加载配置文件失败:", error);
                // 即使失败，也尝试初始化一下绑定
                initInstallGuide();
            }
        });


        return {
            playlists, current, audioEl, isPlaying,
            currentTime, duration, progress,
            onWheel, onTouchStart, onTouchEnd, goTo,
            togglePlay, onTimeUpdate, onLoaded, onEnded, seek, formatTime,
            showLyrics, lyricLines, openLyrics, closeLyrics, onAudioError
        };

    }
}).mount("#app");
