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

// --- 2. 配置对象 (Configuration) ---

const CONFIG = {
	urls: {
		init: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml",
		update: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
	},
	dataDir: path.join(process.cwd(), "data"),
	latestFile: path.join(process.cwd(), "data", "latest.json"),
} as const;

// --- 3. 纯函数：数据处理 (Pure Functions) ---

/**
 * 解析 XML 字符串为 DailyRate 数组
 * 修复：正则现在兼容单引号 (') 和双引号 (")
 */
const parseEcbXml = (xml: string): DailyRate[] => {
	// 1. 匹配带有 time 属性的 Cube 块
	// 修改点：time=['"]...['"] 兼容两种引号
	const timeBlockRegex =
		/<Cube time=['"](\d{4}-\d{2}-\d{2})['"]>([\s\S]*?)<\/Cube>/g;

	return Array.from(xml.matchAll(timeBlockRegex)).flatMap(
		([_, date, content]) => {
			// 2. 在每个时间块内匹配汇率
			// 修改点：currency=['"]...['"] 和 rate=['"]...['"] 兼容两种引号
			const rateRegex =
				/<Cube currency=['"]([A-Z]{3})['"] rate=['"]([\d\.]+)['"]\/>/g;

			const rates = Array.from(content.matchAll(rateRegex)).reduce(
				(acc, [__, currency, rate]) => ({
					...acc,
					[currency]: parseFloat(rate),
				}),
				{} as Record<string, number>,
			);

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
 * 从数组中找出日期最新的一条数据
 */
const findLatestRate = (rates: DailyRate[]): DailyRate | null => {
	if (rates.length === 0) return null;
	return rates.reduce((latest, current) =>
		current.date > latest.date ? current : latest,
	);
};

/**
 * 合并新旧数据并去重
 */
const mergeRates = (
	existing: DailyRate[],
	incoming: DailyRate[],
): DailyRate[] => {
	const rateMap = new Map(
		[...existing, ...incoming].map((item) => [item.date, item]),
	);

	return Array.from(rateMap.values()).sort((a, b) =>
		b.date.localeCompare(a.date),
	);
};

// --- 4. 副作用函数：IO 操作 (Side Effects) ---

const fetchText = async (url: string): Promise<string> => {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
	return res.text();
};

const readJsonFile = async <T = DailyRate[]>(
	filePath: string,
	defaultValue: T,
): Promise<T> => {
	return fs
		.readFile(filePath, "utf-8")
		.then((text) => JSON.parse(text) as T)
		.catch(() => defaultValue);
};

const writeJsonFile = async (
	filePath: string,
	data: unknown,
): Promise<void> => {
	const dir = path.dirname(filePath);
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};

const processGroup = async (
	monthKey: string,
	newRates: DailyRate[],
): Promise<void> => {
	const [year, month] = monthKey.split("/");
	const filePath = path.join(CONFIG.dataDir, year, month, "data.json");

	const existingRates = await readJsonFile(filePath, [] as DailyRate[]);
	const mergedRates = mergeRates(existingRates, newRates);

	await writeJsonFile(filePath, mergedRates);
};

const processLatest = async (newLatest: DailyRate): Promise<void> => {
	const existingLatest = await readJsonFile<DailyRate | null>(
		CONFIG.latestFile,
		null,
	);

	if (!existingLatest || newLatest.date > existingLatest.date) {
		await writeJsonFile(CONFIG.latestFile, newLatest);
	}
};

// --- 5. 主流程 (Main Composition) ---

const execute = async () => {
	const command = process.argv[2] as keyof typeof CONFIG.urls;
	const url = CONFIG.urls[command];

	if (!url) {
		console.error("Usage: npm run init | npm run update");
		process.exit(1);
	}

	console.log(`🚀 Starting [${command}] process...`);

	try {
		const xmlRaw = await fetchText(url);
		// 1. 解析 (已修复引号问题)
		const rates = parseEcbXml(xmlRaw);
		console.log(`📊 Parsed ${rates.length} daily records.`);

		if (rates.length === 0) {
			console.log("⚠️ No rates found in XML (Check regex or source).");
			return;
		}

		// 2. 准备数据
		const grouped = groupRatesByMonth(rates);
		const groupKeys = Object.keys(grouped);
		const latestRate = findLatestRate(rates);

		// 3. 执行写入
		const tasks: Promise<void>[] = [
			...groupKeys.map((key) => processGroup(key, grouped[key])),
		];

		if (latestRate) {
			tasks.push(processLatest(latestRate));
		}

		await Promise.all(tasks);

		console.log(
			`✨ Completed! Updated ${groupKeys.length} month-files ${
				latestRate ? `and latest.json (${latestRate.date})` : ""
			}.`,
		);
	} catch (error) {
		console.error("❌ Error:", error instanceof Error ? error.message : error);
		process.exit(1);
	}
};

execute();
