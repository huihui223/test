/**
 * 冒泡排序（升序，原地排序）
 * @param {number[]} arr 待排序数组
 * @returns {number[]} 排序后的数组（原数组）
 */
function bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        swapped = true;
      }
    }
    // 一轮没有交换说明已经有序，提前结束
    if (!swapped) break;
  }
  return arr;
}

// 简单自测
if (typeof require !== 'undefined' && require.main === module) {
  const cases = [
    { input: [5, 2, 9, 1, 7, 3], expected: [1, 2, 3, 5, 7, 9] },
    { input: [1, 2, 3, 4, 5], expected: [1, 2, 3, 4, 5] },   // 已有序，走提前退出
    { input: [5, 4, 3, 2, 1], expected: [1, 2, 3, 4, 5] },   // 逆序
    { input: [], expected: [] },                             // 空数组
    { input: [42], expected: [42] },                         // 单元素
    { input: [3, 3, 1, 2, 3], expected: [1, 2, 3, 3, 3] },   // 重复元素
  ];

  for (const { input, expected } of cases) {
    const result = bubbleSort([...input]);
    const ok1 = JSON.stringify(result) === JSON.stringify(expected);
    console.log(`${ok1 ? 'PASS' : 'FAIL'} bubbleSort(${JSON.stringify(input)}) -> ${JSON.stringify(result)}`);
    if (!ok1) process.exitCode = 1;
  }
}

module.exports = bubbleSort;
