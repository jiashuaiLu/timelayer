import type {
  ChangeKind,
  CityId,
  Point,
  Provenance,
  SliceType,
  UseKind,
} from "@/domain/types";

/**
 * Block plans are authored in a flat, axis-aligned "drafting" frame (metres), then
 * rotated and projected at compile time. This keeps the hand-drawn street logic
 * readable while the rendered plan still sits at a believable angle.
 */

export interface StreetPlan {
  id: string;
  name: string;
  nameZh?: string;
  /** axis-aligned in drafting space */
  line: Point[];
  width: number;
  kind: "avenue" | "street" | "lane";
  lifespan?: { from: number; to: number };
  severedBy?: string;
}

export interface LandmarkPlan {
  id: string;
  name: string;
  use: UseKind;
  /** centre + size in drafting space */
  center: Point;
  size: { w: number; h: number };
  built: number;
  demolished?: number;
  reuse?: { year: number; use: UseKind; label: string };
}

export interface EventPlan {
  id: string;
  kind: ChangeKind;
  year: number;
  landmarkId?: string;
  /** midpoint of a severed street, drafting space */
  anchor?: Point;
  label: string;
  fact: string;
  hook: string;
  /** editorial weight: which story deserves the card, chosen by a human not a model */
  story?: number;
  source: string;
  provenance: Provenance;
  facts: {
    subject: string;
    from?: string;
    to?: string;
    yearsLater?: number;
    street?: string;
  };
}

export interface SlicePlan {
  year: number;
  type: SliceType;
  label: string;
  source: string;
  fullCoverage?: boolean;
}

export interface BlockPlan {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  city: CityId;
  cityName: string;
  cityNameEn: string;
  borough: string;
  centroid: { lng: number; lat: number };
  radiusM: number;
  rotation: number;
  paper: "warm" | "cool";
  hookLine: string;
  aliases: string[];
  era: { from: number; to: number };
  streets: StreetPlan[];
  landmarks: LandmarkPlan[];
  events: EventPlan[];
  slices: SlicePlan[];
}

const NYC = {
  city: "nyc" as const,
  cityName: "纽约",
  cityNameEn: "New York",
  paper: "warm" as const,
};

export const SUNNYSIDE: BlockPlan = {
  id: "sunnyside-44dr",
  slug: "sunnyside-44dr",
  name: "桑尼赛德 · 44 大道",
  nameEn: "Sunnyside, 44th Drive",
  ...NYC,
  borough: "皇后区",
  centroid: { lng: -73.9241, lat: 40.74425 },
  radiusM: 620,
  rotation: 24,
  hookLine: "一条被高架切开的街",
  aliases: [
    "sunnyside",
    "sunny side",
    "sunnyside gardens",
    "queens",
    "44th drive",
    "44 drive",
    "23rd street",
    "skillman",
    "skillman avenue",
    "39th avenue",
    "queens boulevard",
    "queens blvd",
    "11101",
    "long island city",
  ],
  era: { from: 1922, to: 1931 },
  streets: [
    { id: "s-23", name: "23rd Street", nameZh: "23 街", line: [{ x: -128, y: -160 }, { x: -128, y: 180 }], width: 14, kind: "street" },
    { id: "s-44", name: "44th Drive", nameZh: "44 大道", line: [{ x: 0, y: -160 }, { x: 0, y: 180 }], width: 16, kind: "street" },
    { id: "s-45", name: "45th Avenue", nameZh: "45 街", line: [{ x: 128, y: -160 }, { x: 128, y: 180 }], width: 12, kind: "street" },
    { id: "s-qb", name: "Queens Boulevard", nameZh: "皇后大道", line: [{ x: -180, y: -118 }, { x: 180, y: -118 }], width: 34, kind: "avenue" },
    { id: "s-sk", name: "Skillman Avenue", nameZh: "斯基尔曼大道", line: [{ x: -180, y: 12 }, { x: 180, y: 12 }], width: 14, kind: "street" },
    { id: "s-39", name: "39th Avenue", nameZh: "39 大道", line: [{ x: -180, y: 138 }, { x: 180, y: 138 }], width: 12, kind: "street" },
    {
      id: "s-39pl",
      name: "39th Place",
      nameZh: "39 巷",
      line: [{ x: 64, y: -96 }, { x: 64, y: 52 }],
      width: 9,
      kind: "lane",
      lifespan: { from: 1912, to: 1968 },
      severedBy: "高速连接线",
    },
  ],
  landmarks: [
    { id: "lm-theatre", name: "Sunnyside Theatre", use: "theatre", center: { x: 58, y: 66 }, size: { w: 46, h: 40 }, built: 1929, demolished: 1971 },
    {
      id: "lm-rink",
      name: "Sunnyside Ice Rink",
      use: "rink",
      center: { x: -70, y: 64 },
      size: { w: 50, h: 34 },
      built: 1936,
      demolished: 1989,
      reuse: { year: 1974, use: "store", label: "保龄球馆" },
    },
    { id: "lm-tower", name: "44th Drive Tower", use: "tower", center: { x: 66, y: -62 }, size: { w: 34, h: 30 }, built: 2017 },
    {
      id: "lm-barn",
      name: "Trolley Car Barn",
      use: "garage",
      center: { x: -74, y: -64 },
      size: { w: 48, h: 30 },
      built: 1910,
      demolished: 1954,
    },
    { id: "lm-garden", name: "43rd Road Garden", use: "civic", center: { x: -68, y: -58 }, size: { w: 30, h: 24 }, built: 2004 },
  ],
  events: [
    {
      id: "ev-theatre",
      kind: "vanished",
      year: 1971,
      story: 10,
      landmarkId: "lm-theatre",
      label: "Sunnyside 剧院被拆除",
      fact: "1929 年启用的 Sunnyside 剧院于 1967 年停业，1971 年拆除，原址改为停车场。",
      hook: "一座剧院的熄灯",
      source: "Queens 影剧档案（演示）",
      provenance: "demo",
      facts: { subject: "Sunnyside 剧院", from: "电影院", to: "停车场", yearsLater: 46 },
    },
    {
      id: "ev-tower",
      kind: "appeared",
      year: 2017,
      story: 4,
      landmarkId: "lm-tower",
      label: "煤气公司车库让位于住宅塔楼",
      fact: "煤气公司车库用地上，一栋 14 层住宅楼于 2017 年封顶。",
      hook: "车库上长出的塔楼",
      source: " Queens 建筑许可摘要（演示）",
      provenance: "demo",
      facts: { subject: "14 层住宅楼", from: "车库", to: "住宅塔楼", street: "44th Drive" },
    },
    {
      id: "ev-rink",
      kind: "reused",
      year: 1974,
      story: 7,
      landmarkId: "lm-rink",
      label: "溜冰场改为保龄球馆",
      fact: "1936 年启用的溜冰场 1969 年停业，1974 年改为保龄球馆，1989 年拆除。",
      hook: "体育馆的两次死亡",
      source: "Sunnyside 商会年表（演示）",
      provenance: "demo",
      facts: { subject: "保龄球馆", from: "溜冰场", to: "保龄球馆", yearsLater: 15 },
    },
    {
      id: "ev-cut",
      kind: "severed",
      year: 1968,
      story: 8,
      anchor: { x: 64, y: -22 },
      label: "39 巷被高速连接线切断",
      fact: "39th Place 在 1968 年被高速连接线切断，南段成为断头巷。",
      hook: "被切断的 39 巷",
      source: "纽约市交通局图纸（演示）",
      provenance: "demo",
      facts: { subject: "39th Place", from: "贯通", to: "断头巷", street: "39th Place" },
    },
    {
      id: "ev-barn",
      kind: "vanished",
      year: 1954,
      story: 5,
      landmarkId: "lm-barn",
      label: "有轨电车车库被拆除",
      fact: "1910 年启用的有轨电车车库于 1954 年拆除，让位于皇后大道拓宽。",
      hook: "电车最后一次回场",
      source: "NYC Transit 车库清单（演示）",
      provenance: "demo",
      facts: { subject: "有轨电车车库", from: "车库", to: "道路用地", yearsLater: 12 },
    },
    {
      id: "ev-garden",
      kind: "appeared",
      year: 2004,
      story: 3,
      landmarkId: "lm-garden",
      label: "停车场改为社区花园",
      fact: "一处停车场在 2004 年被改为社区花园，保留至今。",
      hook: "停车场开出的花",
      source: "NYC Parks 社区花园名录（演示）",
      provenance: "demo",
      facts: { subject: "社区花园", from: "停车场", to: "社区花园", street: "43rd Road" },
    },
  ],
  slices: [
    { year: 1924, type: "map", label: "保险地图", source: "Sanborn Fire Insurance（演示）" },
    { year: 1936, type: "aerial", label: "航拍影像", source: "NYC Aerial Survey（演示）" },
    { year: 1951, type: "map", label: "规划图", source: "City Planning 1951（演示）" },
    { year: 1978, type: "photo", label: "税务照片", source: "Municipal Archives（演示）" },
    { year: 1996, type: "street", label: "街景档案", source: "Street Archive（演示）" },
    { year: 2014, type: "street", label: "众包街景", source: "Mapillary（演示）" },
    { year: 2026, type: "map", label: "当代测绘", source: "OSM snapshot（演示）" },
  ],
};

export const CROSBY: BlockPlan = {
  id: "crosby-soho",
  slug: "crosby-soho",
  name: "苏荷 · 克罗斯比街",
  nameEn: "SoHo, Crosby Street",
  ...NYC,
  borough: "曼哈顿",
  centroid: { lng: -73.9993, lat: 40.7237 },
  radiusM: 540,
  rotation: -9,
  hookLine: "同一栋楼，三种人生",
  aliases: [
    "soho",
    "south of houston",
    "crosby",
    "crosby street",
    "manhattan",
    "prince street",
    "spring street",
    "broadway",
    "lafayette",
    "lafayette street",
    "houston",
    "10012",
    "cast iron",
    "cast-iron",
  ],
  era: { from: 1870, to: 1898 },
  streets: [
    { id: "c-laf", name: "Lafayette Street", nameZh: "拉法叶街", line: [{ x: -120, y: -170 }, { x: -120, y: 180 }], width: 18, kind: "street" },
    { id: "c-cro", name: "Crosby Street", nameZh: "克罗斯比街", line: [{ x: 0, y: -170 }, { x: 0, y: 180 }], width: 11, kind: "lane" },
    { id: "c-bwy", name: "Broadway", nameZh: "百老汇", line: [{ x: 122, y: -170 }, { x: 122, y: 180 }], width: 26, kind: "avenue" },
    { id: "c-spr", name: "Spring Street", nameZh: "春街", line: [{ x: -180, y: -116 }, { x: 180, y: -116 }], width: 13, kind: "street" },
    { id: "c-pri", name: "Prince Street", nameZh: "王子街", line: [{ x: -180, y: 8 }, { x: 180, y: 8 }], width: 13, kind: "street" },
    { id: "c-hou", name: "Houston Street", nameZh: "休斯顿街", line: [{ x: -180, y: 136 }, { x: 180, y: 136 }], width: 30, kind: "avenue" },
    {
      id: "c-mel",
      name: "Mercer Street",
      nameZh: "默瑟街",
      line: [{ x: -95, y: 8 }, { x: -95, y: 136 }],
      width: 10,
      kind: "lane",
      lifespan: { from: 1807, to: 1966 },
      severedBy: "城市更新征地",
    },
  ],
  landmarks: [
    {
      id: "lm-loft",
      name: "Crosby Street 铸铁楼",
      use: "loft",
      center: { x: 54, y: 62 },
      size: { w: 40, h: 46 },
      built: 1873,
      reuse: { year: 1998, use: "store", label: "旗舰店" },
    },
    { id: "lm-print", name: "Crosby 印刷厂", use: "factory", center: { x: -58, y: 62 }, size: { w: 46, h: 40 }, built: 1901, demolished: 1965 },
    { id: "lm-stable", name: "Crosby 马厩", use: "civic", center: { x: -60, y: -58 }, size: { w: 34, h: 28 }, built: 1852, demolished: 1938 },
    { id: "lm-tower-soho", name: "Prince Street Tower", use: "tower", center: { x: 56, y: -58 }, size: { w: 30, h: 28 }, built: 2015 },
    { id: "lm-garden-soho", name: "Crosby Garden", use: "civic", center: { x: -58, y: 60 }, size: { w: 30, h: 26 }, built: 1996 },
  ],
  events: [
    {
      id: "ev-loft-art",
      kind: "reused",
      year: 1968,
      story: 10,
      landmarkId: "lm-loft",
      label: "纺织厂被分割为艺术家工作室",
      fact: "1901 年起作纺织厂的铸铁楼，在 1968 年被分割为艺术家工作室。",
      hook: "阁楼里的第一批画",
      source: "SoHo Artists Association（演示）",
      provenance: "demo",
      facts: { subject: "铸铁楼", from: "纺织厂", to: "艺术家工作室", yearsLater: 67 },
    },
    {
      id: "ev-loft-shop",
      kind: "reused",
      year: 1998,
      story: 9,
      landmarkId: "lm-loft",
      label: "工作室整层改为旗舰店",
      fact: "同一栋楼在 1998 年整层改作旗舰店，铸铁立面保留。",
      hook: "同一栋楼三种人生",
      source: "SoHo 商业登记（演示）",
      provenance: "demo",
      facts: { subject: "铸铁楼底层", from: "工作室", to: "旗舰店", yearsLater: 30 },
    },
    {
      id: "ev-print",
      kind: "vanished",
      year: 1965,
      story: 6,
      landmarkId: "lm-print",
      label: "印刷厂在城市更新中拆除",
      fact: "1901 年建成的印刷厂在 1965 年城市更新中被拆除，原址成为空地。",
      hook: "被抹去的印刷厂",
      source: "City Urban Renewal Files（演示）",
      provenance: "demo",
      facts: { subject: "印刷厂", from: "印刷厂", to: "空地", yearsLater: 31 },
    },
    {
      id: "ev-garden-soho",
      kind: "appeared",
      year: 1996,
      story: 5,
      landmarkId: "lm-garden-soho",
      label: "空地上出现社区花园",
      fact: "印刷厂拆除后的空地在 1996 年成为社区花园。",
      hook: "空地上长出的花园",
      source: "NYC Parks 社区花园名录（演示）",
      provenance: "demo",
      facts: { subject: "社区花园", from: "空地", to: "社区花园", yearsLater: 31 },
    },
    {
      id: "ev-lomex",
      kind: "severed",
      year: 1966,
      story: 8,
      anchor: { x: -95, y: 72 },
      label: "默瑟街被征地切断",
      fact: "1966 年的高速征地清空了默瑟街北段，这条连接至今没有恢复。",
      hook: "没能建成的高速",
      source: "LOMEX 征地图纸（演示）",
      provenance: "demo",
      facts: { subject: "Mercer Street", from: "贯通", to: "断头巷", street: "Mercer Street" },
    },
    {
      id: "ev-stable",
      kind: "vanished",
      year: 1938,
      story: 4,
      landmarkId: "lm-stable",
      label: "马厩让位于加油站",
      fact: "1852 年的马厩在 1938 年拆除，街角建起加油站。",
      hook: "马厩的最后一夜",
      source: "Manhattan 税务记录（演示）",
      provenance: "demo",
      facts: { subject: "马厩", from: "马厩", to: "加油站", yearsLater: 86 },
    },
  ],
  slices: [
    { year: 1880, type: "map", label: "保险地图", source: "Sanborn Fire Insurance（演示）" },
    { year: 1902, type: "map", label: "税务地图", source: "Bromley Atlas（演示）" },
    { year: 1925, type: "aerial", label: "航拍影像", source: "Fairchild Aerial（演示）" },
    { year: 1965, type: "map", label: "更新勘测图", source: "Urban Renewal Survey（演示）" },
    { year: 1974, type: "photo", label: "税务照片", source: "Municipal Archives（演示）" },
    { year: 1998, type: "street", label: "街景档案", source: "Street Archive（演示）" },
    { year: 2012, type: "street", label: "众包街景", source: "Mapillary（演示）" },
    { year: 2026, type: "map", label: "当代测绘", source: "OSM snapshot（演示）" },
  ],
};

export const PLANS: BlockPlan[] = [SUNNYSIDE, CROSBY];
