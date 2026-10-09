/**
 * 防抖：连续调用时只执行最后一次，停止调用 wait 毫秒后才触发
 * @param {Function} fn 需要防抖的函数
 * @param {number} wait 等待毫秒数
 * @returns {Function} 防抖后的函数，带 cancel() 方法可取消待执行的调用
 * @throws {TypeError} fn 非函数或 wait 非有限非负数时抛出
 */
function debounce(fn, wait) {
  if (typeof fn !== 'function') {
    throw new TypeError('debounce 的第一个参数必须是函数');
  }
  if (typeof wait !== 'number' || !Number.isFinite(wait) || wait < 0) {
    throw new TypeError('debounce 的第二个参数必须是有限的非负数');
  }

  let timer = null;
  const debounced = function (...args) {
    // 每次调用都重置定时器，只有停止调用超过 wait 后才真正执行
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
  // 手动取消尚未执行的调用
  debounced.cancel = function () {
    clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

// 简单自测
if (typeof require !== 'undefined' && require.main === module) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let failed = 0;
  const check = (name, ok) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
    if (!ok) failed++;
  };

  (async () => {
    // 用例1：快速连续调用只执行最后一次，且参数透传
    const calls = [];
    const debounced = debounce((...args) => calls.push(args), 50);
    debounced(1);
    debounced(2);
    await sleep(25);       // 25ms 时再调一次，等待应被重置
    debounced(3);
    await sleep(75);       // 已超过 wait=50ms，此时应恰好执行了最后一次调用
    check('连续调用只执行最后一次', calls.length === 1 && calls[0][0] === 3);

    // 用例2：this 透传
    const obj = { name: 'obj' };
    let ctx = null;
    obj.debounced = debounce(function () { ctx = this; }, 20);
    obj.debounced();
    await sleep(60);
    check('this 透传', ctx === obj);

    // 用例3：cancel 取消待执行调用
    let cancelledCalls = 0;
    const cancellable = debounce(() => cancelledCalls++, 30);
    cancellable();
    cancellable.cancel();
    await sleep(60);
    check('cancel 取消待执行调用', cancelledCalls === 0);

    // 用例4：参数校验，非法输入抛 TypeError
    const throwsTypeError = (run) => {
      try {
        run();
        return false;
      } catch (err) {
        return err instanceof TypeError;
      }
    };
    check('fn 非函数抛 TypeError', throwsTypeError(() => debounce(123, 50)));
    check('wait 非法抛 TypeError', throwsTypeError(() => debounce(() => {}, -1)));

    if (failed > 0) process.exitCode = 1;
  })();
}

module.exports = debounce;
