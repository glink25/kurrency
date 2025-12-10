# Kurrency

A lightweight Node.js tool for archiving currency exchange rates from the European Central Bank (ECB) into structured JSON files.

一个用于获取并归档欧洲央行（ECB）汇率数据到结构化 JSON 文件的轻量级 Node.js 工具。

## Features / 功能

  * **Source**: Fetches data directly from ECB (European Central Bank).
    **数据源**：直接从欧洲央行获取数据。
  * **Storage**: Organizes data by `Year/Month` in JSON format (e.g., `data/2023/11/data.json`).
    **存储**：按 `年/月` 分类存储为 JSON 文件（例如 `data/2023/11/data.json`）。
  * **Format**: Stores daily exchange rates based on EUR.
    **格式**：存储基于欧元（EUR）的每日汇率。
  * **Zero Dependency**: Built with TypeScript using native Fetch and FS APIs (minimal runtime dependencies).
    **零依赖**：使用 TypeScript 编写，仅使用原生 Fetch 和 FS API（极少的运行时依赖）。

## Data Structure / 数据结构

Data is stored in `data/{year}/{month}/data.json`.
数据存储在 `data/{year}/{month}/data.json` 路径下。

**Type Definition / 类型定义**:

```typescript
interface DailyRate {
  date: string;  // "YYYY-MM-DD"
  base: string;  // "EUR"
  rates: {
    [currencyCode: string]: number;
  };
}
```

**Example / 示例**:

```json
[
  {
    "date": "2023-11-20",
    "base": "EUR",
    "rates": {
      "USD": 1.092,
      "CNY": 7.885,
      "JPY": 162.15
    }
  }
]
```

## Usage / 使用方法

### 1\. Install / 安装

```bash
npm install
```

### 2\. Initialize History / 初始化历史数据

Fetches all historical exchange rates since 1999.
获取自 1999 年以来的所有历史汇率数据。

```bash
npm run init
```

### 3\. Daily Update / 每日更新

Fetches the latest rates and appends them to the current month's file.
获取最新汇率并追加到当月的文件中。

```bash
npm run update
```

## Automation / 自动化

This project is configured with **GitHub Actions** to run `npm run update` automatically every day at 17:00 UTC.
本项目已配置 **GitHub Actions**，将于每天 UTC 时间 17:00 自动运行 `npm run update` 并提交数据。