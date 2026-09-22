/**
 * 二叉树节点
 * @param {number} val 节点值
 * @param {TreeNode|null} left 左子节点
 * @param {TreeNode|null} right 右子节点
 */
function TreeNode(val, left, right) {
  this.val = val === undefined ? 0 : val;
  this.left = left === undefined ? null : left;
  this.right = right === undefined ? null : right;
}

/**
 * 前序遍历二叉树（根 -> 左 -> 右）
 * @param {TreeNode|null} root 二叉树根节点
 * @param {number[]} result 收集遍历结果的数组（递归内部使用）
 * @returns {number[]} 前序遍历的节点值数组
 */
function preorderTraversal(root, result = []) {
  if (!root) return result;
  result.push(root.val);          // 先访问根
  preorderTraversal(root.left, result);  // 再遍历左子树
  preorderTraversal(root.right, result); // 最后遍历右子树
  return result;
}

// 简单自测
if (typeof require !== 'undefined' && require.main === module) {
  const node = (val, left, right) => new TreeNode(val, left, right);

  const cases = [
    //       1
    //      / \
    //     2   3
    //    / \    \
    //   4   5    6
    {
      input: node(1, node(2, node(4), node(5)), node(3, null, node(6))),
      expected: [1, 2, 4, 5, 3, 6],
    },
    { input: node(42), expected: [42] },          // 单节点
    { input: null, expected: [] },                // 空树
    { input: node(3, node(2, node(1)), null), expected: [3, 2, 1] }, // 左斜树
    { input: node(1, null, node(2, null, node(3))), expected: [1, 2, 3] }, // 右斜树
  ];

  for (const { input, expected } of cases) {
    const result = preorderTraversal(input);
    const ok = JSON.stringify(result) === JSON.stringify(expected);
    console.log(`${ok ? 'PASS' : 'FAIL'} preorderTraversal -> ${JSON.stringify(result)}`);
    if (!ok) process.exitCode = 1;
  }
}

module.exports = preorderTraversal;
module.exports.TreeNode = TreeNode;
