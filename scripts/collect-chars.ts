import { allBlocks } from "../src/data/blocks";
import { buildVerdict, storyHeadline } from "../src/pipeline/narrative";

const fixed =
  "时间街道一条街的传记一百年拖就看完了看看你的街区档案切片当代无记录年演示数据纽约皇后区曼哈顿街区尺度半径不显示门牌号图源" +
  "消失新增用途变更已消失拖动卷尺每一格都是真实存在过的年份街区传记卡片下载长图复制分享链接收起只显示街区名不含门牌号" +
  "今天的街区不会显示你的门牌直接看读取街区定位中例如输入一个地址过去发生了什么来自市政档案编号一二三四五六七八九十";

const chars = new Set<string>(Array.from(fixed));
const add = (s: string) => Array.from(s).forEach((c) => { if (c.trim()) chars.add(c); });

for (const block of allBlocks()) {
  add(block.name); add(block.cityName); add(block.borough); add(block.cityNameEn);
  add(block.hookLine);
  for (const e of block.events) { add(e.hook); add(e.label); add(e.fact); add(e.facts.subject ?? ""); add(e.source); }
  for (const s of block.slices) { add(s.label); add(s.source); }
  const years = block.slices.map((s) => s.year);
  add(buildVerdict(block, years[0], years[years.length - 1]));
  add(storyHeadline(block).hook);
  for (const y of years) {
    for (const other of years) add(buildVerdict(block, Math.min(y, other), Math.max(y, other)));
  }
}
for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;-—·/()（）： ") chars.add(c);
const out = Array.from(chars).sort().join("").replace(/\s/g, "");
console.log(out.length);
console.log(out);
