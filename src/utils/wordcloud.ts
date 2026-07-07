// 词云分词/词频启发式 —— 零依赖、无分词库、无 AI（遵守 NFR1/NFR4）。
//
// 思路：中文虚词（的/了/在/是……）本身就是词与词之间的"天然分隔符"。
// 以虚词字符切开中文串，剩下的连续内容块（2–4 字）即视为候选词，
// 再按 词频 × 字长权重 排序，使能反映生活主题的多字词优先于通用双字词。

// 语气词 / 助词 / 代词 / 副词 / 介词 / 连词 / 量词等"虚词字符"。
// 作为分隔符：任一内容块中不含这些字符，块内相邻字才被视为同一个词。
const FUNCTION_CHARS = new Set(
  (
    '的了在是我有和就不都一也很到说要去你会着看好这那什么吗吧呢啊哦嗯呀哈啦' +
    '他她它们个之与及或但而且因为所以如果虽然还把被让给对从向往被得地把' +
    '上下里外前后中间时候已经曾经然后于是就是还是只是不过可是就算即使' +
    '我们你们他们她们自己大家谁哪怎么这样那样一样这些那些每每次每天' +
    '没没有再又才刚正在将要能可以应该必须一直总是常常经常有点有些非常十分' +
    '其实当然反正毕竟居然竟然难道简直几乎差不多大概也许可能一些一点点儿些'
  ).split('')
);

// 完整停用词（即便成块也过滤）—— 高频但无主题意义的常见短语。
const STOP_WORDS = new Set([
  '知道', '觉得', '感觉', '发现', '希望', '开始', '结束', '时间', '今天', '昨天',
  '明天', '现在', '以后', '之前', '之后', '一下', '一点', '这个', '那个', '东西',
  '事情', '问题', '样子', '地方', '所有', '这里', '那里', '什么样',
]);

const CHINESE_RUN = /[一-龥]+/g;

// 字长权重：多字词更可能承载生活主题，给予更高排序权重。
const lengthWeight = (len: number): number => {
  if (len >= 4) return 2.0;
  if (len === 3) return 1.6;
  return 1.0; // 2 字
};

const MIN_LEN = 2;
const MAX_LEN = 4;

/**
 * 从一段文本累加加权词频到给定 map。
 * 返回的 count 是「频次 × 字长权重」的加权分数，仅用于排序/分级，不直接展示。
 */
export const accumulateWordFrequency = (
  text: string,
  wordCount: Map<string, number>
): void => {
  const runs = text.match(CHINESE_RUN);
  if (!runs) return;

  for (const run of runs) {
    // 以虚词字符为分隔，切出内容块
    let chunk = '';
    const flush = () => {
      if (chunk.length >= MIN_LEN) {
        emitChunk(chunk, wordCount);
      }
      chunk = '';
    };

    for (const ch of run) {
      if (FUNCTION_CHARS.has(ch)) {
        flush();
      } else {
        chunk += ch;
      }
    }
    flush();
  }
};

const emitChunk = (chunk: string, wordCount: Map<string, number>): void => {
  // 2–4 字的块直接作为词；过长的块回退到 2/3 字窗口，避免整句成词
  if (chunk.length <= MAX_LEN) {
    addWord(chunk, wordCount);
    return;
  }
  for (let size = 3; size >= 2; size--) {
    for (let i = 0; i + size <= chunk.length; i++) {
      addWord(chunk.substring(i, i + size), wordCount);
    }
  }
};

const addWord = (word: string, wordCount: Map<string, number>): void => {
  if (STOP_WORDS.has(word)) return;
  wordCount.set(word, (wordCount.get(word) || 0) + lengthWeight(word.length));
};
