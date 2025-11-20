import fs from "node:fs/promises";
import path from "node:path";
import { parse, format } from "date-fns";

// --- 1. 类型定义 (Type Definitions) ---

export type CurrencyCode = string;

export interface DailyRate {
	readonly date: string;
	readonly base: string;
	readonly rates: Record<CurrencyCode, number>;
}

// 类似 Result 模式的简单配置对象
const CONFIG = {
	urls: {
		init: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml",
		update: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
	},
	dataDir: path.join(process.cwd(), "data"),
} as const;

// --- 2. 纯函数：数据处理 (Pure Functions) ---

/**
 * 解析 XML 字符串为 DailyRate 数组
 * 使用 matchAll 和 flatMap 替代传统的循环，减少状态管理
 */
const parseEcbXml = (xml: string): DailyRate[] => {
	// 匹配带有 time 属性的 Cube 块
	const timeBlockRegex = /<Cube time="(\d{4}-\d{2}-\d{2})">([\s\S]*?)<\/Cube>/g;

	return Array.from(xml.matchAll(timeBlockRegex)).flatMap(
		([_, date, content]) => {
			// 在每个时间块内匹配汇率
			const rateRegex = /<Cube currency="([A-Z]{3})" rate="([\d\.]+)"\/>/g;

			const rates = Array.from(content.matchAll(rateRegex)).reduce(
				(acc, [__, currency, rate]) => ({
					...acc,
					[currency]: parseFloat(rate),
				}),
				{} as Record<string, number>,
			);

			// 只有当解析出汇率数据时才返回对象
			return Object.keys(rates).length > 0
				? [{ date, base: "EUR", rates }]
				: [];
		},
	);
};

/**
 * 将扁平的汇率数组按 "YYYY/MM" 分组
 */
const groupRatesByMonth = (rates: DailyRate[]): Record<string, DailyRate[]> => {
	return rates.reduce(
		(groups, rate) => {
			const dateObj = parse(rate.date, "yyyy-MM-dd", new Date());
			const key = format(dateObj, "yyyy/MM");

			return {
				...groups,
				[key]: [...(groups[key] ?? []), rate],
			};
		},
		{} as Record<string, DailyRate[]>,
	);
};

/**
 * 合并新旧数据并去重
 * 逻辑：将数组转为 Map (以 date 为 Key) 自动去重，优先保留新数据，最后转回数组排序
 */
const mergeRates = (
	existing: DailyRate[],
	incoming: DailyRate[],
): DailyRate[] => {
	const rateMap = new Map(
		[...existing, ...incoming].map((item) => [item.date, item]),
	);

	return Array.from(rateMap.values()).sort(
		(a, b) => b.date.localeCompare(a.date), // 降序排列 (最新的在前)
	);
};

// --- 3. 副作用函数：IO 操作 (Side Effects) ---

const fetchText = async (url: string): Promise<string> => {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
	return res.text();
};

const readJsonFile = async (filePath: string): Promise<DailyRate[]> => {
	return fs
		.readFile(filePath, "utf-8")
		.then((text) => JSON.parse(text) as DailyRate[])
		.catch(() => []); // 文件不存在或解析失败时返回空数组，保证流程不中断
};

const writeJsonFile = async (
	filePath: string,
	data: DailyRate[],
): Promise<void> => {
	const dir = path.dirname(filePath);
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};

/**
 * 处理单个月份的数据存储
 */
const processGroup = async (
	monthKey: string,
	newRates: DailyRate[],
): Promise<void> => {
	const [year, month] = monthKey.split("/");
	const filePath = path.join(CONFIG.dataDir, year, month, "data.json");

	const existingRates = await readJsonFile(filePath);
	const mergedRates = mergeRates(existingRates, newRates);

	await writeJsonFile(filePath, mergedRates);
	// console.log(`✅ Saved ${monthKey} (${mergedRates.length} records)`);
};

// --- 4. 主流程 (Main Composition) ---

const execute = async () => {
	const command = process.argv[2] as keyof typeof CONFIG.urls;
	const url = CONFIG.urls[command];

	if (!url) {
		console.error("Usage: npm run init | npm run update");
		process.exit(1);
	}

	console.log(`🚀 Starting [${command}] process...`);

	try {
		// 1. 获取 & 解析
		const xmlRaw = await fetchText(url);
		const rates = parseEcbXml(xmlRaw);
		console.log(`📊 Parsed ${rates.length} daily records.`);

		// 2. 分组
		const grouped = groupRatesByMonth(rates);
		const groupKeys = Object.keys(grouped);

		// 3. 并行处理文件写入 (使用 Promise.all 提升 IO 效率)
		await Promise.all(groupKeys.map((key) => processGroup(key, grouped[key])));

		console.log(`✨ Completed! Updated ${groupKeys.length} month-files.`);
	} catch (error) {
		console.error("❌ Error:", error instanceof Error ? error.message : error);
		process.exit(1);
	}
};

// 运行
execute();
