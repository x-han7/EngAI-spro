<template>
  <div class="min-h-[60vh] bg-zinc-50/80">
    <div class="w-[1200px] mx-auto px-4 pt-12 pb-24">
      <header class="mb-10 text-center">
        <h1 class="text-3xl font-bold text-zinc-900 tracking-tight sm:text-4xl">{{ title }}</h1>
        <p class="mt-3 text-zinc-500 text-sm">请根据释义和翻译拼写单词</p>
      </header>

      <el-skeleton v-if="isLoading" :rows="10" animated />

      <div v-if="list.length === 0" class="flex justify-center py-20">
        <el-empty description="暂无单词或您尚未购买该课程" />
      </div>

      <template v-else>
        <!-- 本组已学完 - 触发盛大庆祝 -->
        <div v-if="currentIndex >= list.length" class="text-center py-16 px-6 bg-white rounded-2xl border border-zinc-100 shadow-sm">
          <p class="text-zinc-600 mb-6">本组 10 个词已学完</p>
          <el-button type="primary" size="large" @click="saveWordMaster"> 再练一组 </el-button>
        </div>

        <!-- 当前单词卡片 -->
        <div v-else>
          <div class="mb-4 flex items-center justify-between text-sm text-zinc-500">
            <span>第 {{ currentIndex + 1 }} / {{ list.length }} 个</span>
          </div>
          <article class="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            <div class="p-8 sm:p-10 relative">
              <div class="flex justify-center mb-6">
                <div
                  :class="{ 'filter blur-md select-none': isWordBlurred }"
                  class="transition-all duration-300 min-h-10 flex flex-col items-center text-center"
                >
                  <div class="text-2xl sm:text-3xl font-bold text-indigo-600 tracking-tight">
                    {{ currentWord?.word }}
                  </div>
                  <div class="flex items-center justify-center gap-2 mt-1">
                    <span v-if="currentWord?.phonetic" class="text-base text-zinc-500 font-mono">
                      {{ currentWord.phonetic }}
                    </span>
                    <el-icon
                      v-if="currentWord?.word"
                      class="shrink-0 cursor-pointer text-slate-400 hover:text-indigo-400 transition-colors"
                      :size="18"
                      title="发音"
                      @click="playAudio(currentWord!.word)"
                    >
                      <VideoPlay />
                    </el-icon>
                  </div>
                </div>
                <el-icon
                  class="absolute! right-10 top-10 cursor-pointer text-slate-400 hover:text-indigo-400 transition-colors"
                  :size="18"
                  :title="isWordBlurred ? '点击或按Tab键显示单词' : '点击或按Tab键隐藏单词'"
                  @click="isWordBlurred = !isWordBlurred"
                >
                  <View v-if="isWordBlurred" />
                  <Hide v-else />
                </el-icon>
              </div>
              <!-- 释义 -->
              <div class="mb-4 rounded-lg bg-zinc-50/80 border border-zinc-100 p-4">
                <p class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">释义</p>
                <div class="text-zinc-700 leading-relaxed prose prose-sm max-w-none" v-html="formatHtml(currentWord?.definition)" />
              </div>
              <!-- 翻译 -->
              <div class="rounded-lg bg-zinc-50/80 border border-zinc-100 p-4">
                <p class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">翻译</p>
                <div
                  class="text-zinc-600 leading-relaxed whitespace-pre-line prose prose-sm max-w-none"
                  v-html="formatHtml(currentWord?.translation)"
                />
              </div>
              <!--拼写练习-->
              <div class="rounded-lg bg-zinc-50/80 border border-zinc-100 p-4">
                <p class="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">拼写</p>
                <div class="flex items-center gap-2 justify-center">
                  <input
                    :maxlength="1"
                    ref="inputRefs"
                    @input="onInput(index)"
                    v-for="(item, index) in wordList"
                    @keydown="onKeyDown(index, $event)"
                    :key="index"
                    type="text"
                    v-model="item.input"
                    :class="{ 'border-indigo-500!': item.isTrue === true, 'border-red-500!': item.isTrue === false }"
                    class="border-0 border-b-2 border-zinc-300 focus:border-indigo-500 bg-transparent outline-none w-10 text-center text-2xl font-bold"
                  />
                </div>
              </div>
              <!--控制按钮-->
              <div class="flex justify-end gap-2">
                <el-button type="primary" @click="pagePrev"> 上一个 </el-button>
                <el-button type="primary" @click="pageNext"> 下一个 </el-button>
              </div>
            </div>
          </article>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed, useTemplateRef } from "vue";
import { useRoute } from "vue-router";
import type { Word } from "@en/common/word";
import { useAudio } from "@/hooks/useAudio";
import { View, Hide, VideoPlay } from "@element-plus/icons-vue";
import { getWordList, saveWordMaster as saveWordMasterApi } from "@/apis/learn";
import { ElMessage } from "element-plus";
import { useUserStore } from "@/stores/user";
// 引入 canvas-confetti 库
import confetti from "canvas-confetti";

const userStore = useUserStore();
const inputRefs = useTemplateRef<HTMLInputElement[]>("inputRefs");

interface WordItem {
  word: string;
  input: string;
  isTrue: boolean | undefined;
}

const { playAudio } = useAudio({}); //发音的api
const route = useRoute();
const title = route.params.title || "我的课程";
const isLoading = ref(false); //默认不加载
const list = ref<Word[]>([]); //单词列表 [{},{},....] list[currentIndex.value]
const currentIndex = ref(0); //当前单词索引
const isWordBlurred = ref(true); //是否模糊显示单词 默认是模糊的
const currentWord = computed<Word | undefined>(() => list.value[currentIndex.value]); //当前的单词
const wordList = ref<WordItem[]>([]); //拼写列表
// 标记是否已经触发过当前单词的庆祝，防止重复
const hasCelebratedCurrentWord = ref(false);

// --- 音效逻辑 ---
const audioContext = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;
const playTypeSound = () => {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.05);
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.05);
};

// 转换方法
const formatHtml = (text: string | undefined): string => {
  if (!text) return "";
  // 将 \\n 转换为 <br> 标签
  return text.replace(/\\n/g, "<br>");
};

// --- 核心 Watcher ---
watch(
  currentWord,
  (newWord) => {
    // 默认行为：加载新单词时，模糊并清空
    isWordBlurred.value = true;
    // 重置庆祝标记
    hasCelebratedCurrentWord.value = false;
    const currentStr = newWord?.word || "";
    wordList.value = Array.from(currentStr).map((item) => ({
      word: item,
      input: "",
      isTrue: undefined,
    }));

    // 自动播放单词发音（如果是新单词，不是已掌握的）
    if (newWord?.word) {
      nextTick(() => {
        playAudio(newWord.word);
      });
    }
  },
  { immediate: true },
);

// --- 辅助方法：渲染已掌握的单词状态 ---
const renderMasteredWord = () => {
  const currentStr = currentWord.value?.word || "";
  isWordBlurred.value = false; // 取消模糊
  // 重新构建 wordList，但全部标记为正确且填满
  wordList.value = Array.from(currentStr).map((char) => ({
    word: char,
    input: char,
    isTrue: true,
  }));
};

// --- 🎉 级别1：单词拼对时的轻快庆祝（小星星）---
const triggerSmallCelebration = () => {
  // 从输入框位置附近发射小星星
  const colors = ["#FFD700", "#FFA500", "#FF6347", "#87CEEB", "#98FB98"];

  // 左侧小爆发
  confetti({
    particleCount: 15,
    spread: 60,
    startVelocity: 25,
    gravity: 1.2,
    ticks: 100,
    origin: { x: 0.4, y: 0.6 },
    colors: colors,
    shapes: ["star", "circle"],
    scalar: 0.6, // 小粒子
    decay: 0.92,
    drift: 0,
  });

  // 右侧小爆发
  confetti({
    particleCount: 15,
    spread: 60,
    startVelocity: 25,
    gravity: 1.2,
    ticks: 100,
    origin: { x: 0.6, y: 0.6 },
    colors: colors,
    shapes: ["star", "circle"],
    scalar: 0.6,
    decay: 0.92,
    drift: 0,
  });
};

// --- 🎊 级别2：本组学完时的盛大庆祝（精简版两侧发射）---
const triggerGrandCelebration = () => {
  const colors = [
    "#f44336",
    "#e91e63",
    "#9c27b0",
    "#673ab7",
    "#3f51b5",
    "#2196f3",
    "#03a9f4",
    "#00bcd4",
    "#009688",
    "#4CAF50",
    "#8BC34A",
    "#CDDC39",
    "#FFEB3B",
    "#FFC107",
    "#FF9800",
    "#FF5722",
  ];

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  // 只发射3波，每波间隔600ms
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      // 左侧：50粒子，向上喷射
      confetti({
        particleCount: 50,
        angle: randomInRange(45, 75),
        spread: 50,
        origin: { x: 0, y: 0.85 },
        colors: colors,
        startVelocity: 45,
        gravity: 1.2,
        decay: 0.92,
        drift: 2,
        ticks: 250,
      });

      // 右侧：50粒子，向上喷射
      confetti({
        particleCount: 50,
        angle: randomInRange(105, 135),
        spread: 50,
        origin: { x: 1, y: 0.85 },
        colors: colors,
        startVelocity: 45,
        gravity: 1.2,
        decay: 0.92,
        drift: -2,
        ticks: 250,
      });
    }, i * 600);
  }
};

// --- 🎊 级别2：本组学完时的盛大庆祝（持续两侧发射）---
// const triggerGrandCelebration = () => {
//   const duration = 15 * 1000; // 持续15秒
//   const animationEnd = Date.now() + duration;
//   const defaults = {
//     startVelocity: 30,
//     spread: 360,
//     ticks: 60,
//     zIndex: 0,
//     colors: ['#e81416', '#ffa500', '#faeb36', '#79c314', '#487de7', '#4b369d', '#70369d', '#ff1493']
//   };

//   const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

//   const interval: any = setInterval(() => {
//     const timeLeft = animationEnd - Date.now();

//     if (timeLeft <= 0) {
//       return clearInterval(interval);
//     }

//     const particleCount = 50 * (timeLeft / duration);

//     // 左侧发射
//     confetti({
//       ...defaults,
//       particleCount,
//       origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
//     });

//     // 右侧发射
//     confetti({
//       ...defaults,
//       particleCount,
//       origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
//     });
//   }, 250);
// };

//上一个
const pagePrev = () => {
  if (currentIndex.value <= 0) return;
  currentIndex.value--;

  // 切换回来后，立即设置为"已掌握"状态
  nextTick(() => {
    renderMasteredWord();
  });
};

// --- 统一的下一个检查逻辑 ---
const checkAndGoNext = () => {
  if (wordList.value.some((item) => !item.isTrue)) {
    ElMessage.error("请先完成拼写");
    return false;
  }
  pageNext();
  return true;
};

//下一个
const pageNext = () => {
  if (wordList.value.some((item) => !item.isTrue)) {
    ElMessage.error("请先完成拼写");
    return;
  }
  currentIndex.value++;

  // 切换到下一个单词后，自动聚焦到第一个输入框
  nextTick(() => {
    const inputs = inputRefs.value as HTMLInputElement[];
    if (inputs && inputs.length > 0) {
      inputs[0].focus();
    }
  });
};

//保存的方法
const saveWordMaster = async () => {
  const wordIds = list.value.map((item) => item.id);
  const res = await saveWordMasterApi(wordIds);
  if (res.success) {
    currentIndex.value = 0;
    getWordListData();
    userStore.updateUserWordNumber(res.data.wordNumber);
    ElMessage.success(res.message);
  } else {
    ElMessage.error(res.message);
  }
};

// 检查是否完成拼写
const checkWordComplete = () => {
  const allCorrect = wordList.value.every((item) => item.isTrue === true);
  const isLastInput = wordList.value.every((item) => item.input !== "");

  // 只有当全部正确、全部填满、且还没庆祝过时才触发
  if (allCorrect && isLastInput && !hasCelebratedCurrentWord.value) {
    hasCelebratedCurrentWord.value = true;
    triggerSmallCelebration(); // 🎉 撒小星星！

    // 检查是否是本组最后一个单词
    if (currentIndex.value === list.value.length - 1) {
      // 延迟一点触发大礼花，让用户先看到小星星
      setTimeout(() => {
        triggerGrandCelebration(); // 🎊 盛大庆祝！
      }, 800);
    }
  }
};
//输入的方法
const onInput = (index: number) => {
  playTypeSound(); // 播放音效
  const current = wordList.value[index];
  current.isTrue = current.word === current.input;

  // 检查是否完成拼写
  checkWordComplete();

  nextTick(() => {
    const inputs = inputRefs.value as HTMLInputElement[];
    if (inputs && index < inputs.length - 1) {
      inputs[index + 1].focus();
    }
  });
};

//按键的方法
const onKeyDown = (index: number, event: KeyboardEvent) => {
  // 处理 Tab 键 - 切换模糊状态
  if (event.key === "Tab") {
    event.preventDefault();
    isWordBlurred.value = !isWordBlurred.value;
    return;
  }
  // 处理 Enter 键
  if (event.key === "Enter") {
    event.preventDefault();
    checkAndGoNext();
    return;
  }

  // 处理左右方向键
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    pagePrev();
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    checkAndGoNext();
    return;
  }

  // 处理 End 键 - 跳到当前有值的最后一个输入框
  if (event.key === "End") {
    event.preventDefault();
    nextTick(() => {
      const inputs = inputRefs.value as HTMLInputElement[];
      if (!inputs || inputs.length === 0) return;

      // 找到最后一个有值的索引
      const lastFilledIndex = wordList.value.reduce((last, item, index) => (item.input ? index : last), -1);

      const targetIndex = lastFilledIndex === -1 ? 0 : lastFilledIndex;
      inputs[targetIndex]?.focus();
    });
    return;
  }
  // 处理 Home 键 - 跳到第一个输入框
  if (event.key === "Home") {
    event.preventDefault();
    nextTick(() => {
      const inputs = inputRefs.value as HTMLInputElement[];
      if (inputs && inputs.length > 0) {
        inputs[0].focus();
      }
    });
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    const current = wordList.value[index];
    current.input = "";
    current.isTrue = undefined;
    nextTick(() => {
      const inputs = inputRefs.value as HTMLInputElement[];
      if (inputs && index > 0) {
        inputs[index - 1].focus();
      }
    });
  }

  // 字符输入
  if (event.key.length == 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    playTypeSound(); // 播放音效
    const current = wordList.value[index];
    if (current.input && index < wordList.value.length - 1) {
      event.preventDefault();
      wordList.value[index + 1].input = event.key;
      wordList.value[index + 1].isTrue = wordList.value[index + 1].word === event.key;

      // 检查是否完成拼写
      checkWordComplete();

      nextTick(() => {
        const inputs = inputRefs.value as HTMLInputElement[];
        if (inputs) inputs[index + 1].focus();
      });
    }
  }
};

const getWordListData = async () => {
  isLoading.value = true;
  const res = await getWordList(route.params.courseId as string);
  isLoading.value = false;
  if (res.success) {
    list.value = res.data;
  } else {
    ElMessage.error(res.message);
  }
};

onMounted(() => {
  getWordListData();
});
</script>
