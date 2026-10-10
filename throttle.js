/**
 * 节流：连续调用时保证每隔 wait 毫秒最多执行一次
 * 首次调用立即执行，wait 期间内的调用被节流，窗口结束后补发最后一次调用
 * @param {Function} fn 需要节流的函数
 * @param {number} wait 间隔毫秒数
 * @returns {Function} 节流后的函数，带 cancel() 方法可取消待执行的尾部调用
 * @throws {TypeError} fn 非函数或 wait 非有限非负数时抛出
 */
function throttle(fn, wait) {
  if (typeof fn !== 'function') {
    throw new TypeError('throttle 的第一个参数必须是函数');
  }
  if (typeof wait !== 'number' || !Number.isFinite(wait) || wait < 0) {
    throw new TypeError('throttle 的第二个参数必须是有限的非负数');
  }

  let previous = 0;      // 上次执行的毫秒时间戳，0 表示尚未执行过
  let timer = null;      // 尾部补发的定时器
  let lastArgs = null;
  let lastThis = null;

  const throttled = function (...args) {
    const now = Date.now();
    const remaining = wait - (now - previous);

    if (remaining <= 0) {
      // 已超过一个周期，立即执行并开启新周期
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      previous = now;
      fn.apply(this, args);
    } else {
      // 处于节流窗口内，只记录最后一次调用的参数，等待窗口结束补发
      lastArgs = args;
      lastThis = this;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          previous = Date.now();
          fn.apply(lastThis, lastArgs);
          lastArgs = lastThis = null;
        }, remaining);
      }
    }
  };

  // 手动取消尚未执行的尾部调用
  throttled.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    previous = 0;
    lastArgs = lastThis = null;
  };

  return throttled;
}

// 简单自测
if (typeof require !== 'undefined' && require.main === module) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let failed = 0;
  const check = (name, ok) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
    if (!ok) failed++;
  };


}

module.exports = throttle;
