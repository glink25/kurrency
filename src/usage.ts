// How to use kurrency by github file
/**
 * 汇率数据结构 (与 kurrency 项目存储结构保持一致)
 */
export interface DailyRate {
	readonly date: string;
	readonly base: string;
	readonly rates: Record<string, number>;
}

/**
 * 最终返回的汇率对象结构
 */
export interface Rate {
	/** 汇率日期 (YYYY-MM-DD) */
	date: string;
	/** 当前基准货币 */
	base: string;
	/** 相对基准货币的汇率表 */
	rates: Record<string, number>;
}

// 配置项：仓库分支与地址
const REPO_CONFIG = {
	baseUrl: "https://raw.githubusercontent.com/glink25/kurrency/main/data",
	defaultBase: "EUR",
} as const;

/**
 * 辅助函数：格式化日期为 YYYY-MM-DD 和 路径所需的 year/month
 * 使用 UTC 以避免时区导致的日期偏移
 */
const getDateParts = (inputDate: Date) => {
	const y = inputDate.getUTCFullYear();
	const m = inputDate.getUTCMonth() + 1;
	const d = inputDate.getUTCDate();

	const pad = (n: number) => n.toString().padStart(2, "0");

	return {
		year: y.toString(),
		month: pad(m),
		fullDate: `${y}-${pad(m)}-${pad(d)}`, // YYYY-MM-DD
	};
};

/**
 * 核心逻辑：基于指定货币重新计算汇率 (Rebasing)
 * 公式: TargetCurrencyRate = OriginalRate[TargetCurrency] / OriginalRate[NewBase]
 */
const rebaseRates = (dailyData: DailyRate, newBase: string): Rate => {
	// 如果请求的就是原始基准 (EUR)，直接返回
	if (newBase === dailyData.base) {
		return dailyData;
	}

	// 获取新基准货币相对于 EUR 的汇率 (例如 EUR -> USD)
	const baseRate = dailyData.rates[newBase];

	if (!baseRate) {
		throw new Error(`Currency code '${newBase}' not found in exchange rates.`);
	}

	// 重新计算所有汇率
	const newRates = Object.entries(dailyData.rates).reduce(
		(acc, [currency, rate]) => {
			// 避免精度问题，实际项目中通常会引入 Decimal 库，这里使用原生浮点
			acc[currency] = rate / baseRate;
			return acc;
		},
		{} as Record<string, number>,
	);

	// 添加 EUR (因为原始数据中不含 EUR -> EUR)
	newRates[dailyData.base] = 1 / baseRate;

	return {
		date: dailyData.date,
		base: newBase,
		rates: newRates,
	};
};

/**
 * 获取汇率信息
 * * @param base 基础货币代码 (e.g., "USD", "CNY")
 * @param date 指定日期，不指定则使用当前日期
 * @returns 汇率数据 Promise
 */
export const fetchCurrency = async (
	base: string = "EUR",
	date: Date | number = new Date(),
): Promise<Rate> => {
	const targetDateObj = typeof date === "number" ? new Date(date) : date;
	const { year, month, fullDate } = getDateParts(targetDateObj);

	// 1. 构建 GitHub Raw URL
	const url = `${REPO_CONFIG.baseUrl}/${year}/${month}/data.json`;

	try {
		// 2. 请求数据
		const response = await fetch(url);
		if (!response.ok) {
			if (response.status === 404) {
				throw new Error(
					`No data found for ${year}/${month}. The date might be too early or in the future.`,
				);
			}
			throw new Error(
				`GitHub API Error: ${response.status} ${response.statusText}`,
			);
		}

		const dataList: DailyRate[] = await response.json();

		// 3. 查找最近的交易日
		// 数据预设是按日期降序排列的 (2023-10-20, 2023-10-19...)
		// 我们需要找到第一个 date <= targetDate 的记录
		const matchedRecord =
			dataList.find((item) => item.date <= fullDate) ??
			dataList[dataList.length - 1];

		// 4. 转换基准货币并返回
		return rebaseRates(matchedRecord, base);
	} catch (error) {
		// 简单的错误透传，实际使用可根据需要封装
		return Promise.reject(error);
	}
};
