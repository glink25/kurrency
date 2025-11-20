## Init
请编写一个nodejs项目kurrency，该项目的主要作用是将指定日期的汇率信息按照年/月的文件分类存储到json文件中，例如
2001/10/data.json代表2001年10月份每一天的汇率信息，其中汇率包含多个币种。
该项目通过 ecb.europa.eu 获取历史汇率信息，以及最新的汇率信息
该项目的核心功能为：
1，通过`npm run init` 命令，从 api 获取所有的历史汇率信息
2，通过`npm run update` 命令从api更新今日的汇率信息，并追加到历史信息文件中
3，具体的文件时间点分类应该以 ecb.europa.eu 为准

细节：
1，项目应该完全由typescript编写，使用tsx工具运行，并且尽可能减少对其他第三方库的依赖，可以使用原生fetch和date-fns库
2，必须明确最终的汇率json类型，保证即使更换api，也能保证汇率类型的一致性
3，尽可能只使用单ts文件来实现该项目

## Usage
假设该项目已经位于github/glink25/kurrency仓库中，请编写一个无任何第三方依赖的ts文件，导出一个fetchCurrency函数，该函数签名如下，用于展示如何通过github open api获取对应日期的data.json并寻找到与所需日期最近最准确的交易日汇率信息（由于json数据中保存的base为EUR，最终的汇率信息应该根据传入的base进行转换）：
```typescript
/**
 * 获取汇率信息
 * @param base 基础货币代码
 * @param date 指定日期，不指定则使用当前日期
 * @returns 汇率数据 Promise
 */
export const fetchCurrency = async (base: string, date?: Date | number):Rate
```

## Update
我需要该项目每天定时运行命令‘npm run update’一次或多次，并将执行完成后的代码重新提交到main分支中，以实现data文件夹中汇率数据的的每日更新，请帮我生成一个可用的GitHub actions yml文件，并介绍如何使项目每天自动运行