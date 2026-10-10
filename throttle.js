/**
 * 节流：连续调用时保证每隔 wait 毫秒最多执行一次
 * 首次调用立即执行，wait 期间内的调用被节流，窗口结束后补发最后一次调用
 * @param {Function} fn 需要节流的函数
 * @param {number} wait 间隔毫秒数
 * @returns {Function} 节流后的函数，带 cancel() 取消待执行的尾部调用、flush() 立即执行待发的尾部调用并返回结果
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
          // 以预定触发点作为新周期起点，消除定时器延迟造成的累积漂移
          previous += wait;
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

  // 立即执行待发的尾部调用并返回其结果，无待发时不动作返回 undefined
  throttled.flush = function () {
    if (!timer) {
      return undefined;
    }
    clearTimeout(timer);
    timer = null;
    // flush 是手动提前触发，从真实执行时刻开启新窗口
    previous = Date.now();
    const result = fn.apply(lastThis, lastArgs);
    lastArgs = lastThis = null;
    return result;
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

  (async () => {
    // 用例1：首次调用立即执行，期间调用被节流，窗口结束后补发最后一次
    const calls = [];
    const throttled = throttle((v) => calls.push(v), 50);
    throttled(1);
    check('首次调用立即执行', calls.length === 1 && calls[0] === 1);
    throttled(2);
    throttled(3);
    await sleep(25);       // t≈25ms，仍在 wait=50ms 的窗口内
    check('wait 期间调用被节流', calls.length === 1);
    throttled(4);          // 仍在窗口内，覆盖为最后一次调用的参数
    await sleep(50);       // t≈75ms，窗口已在 50ms 处结束并补发
    check('窗口结束补发最后一次调用', calls.length === 2 && calls[1] === 4);

    // 用例2：this 透传
    const obj = { name: 'obj' };
    let ctx = null;
    obj.throttled = throttle(function () { ctx = this; }, 20);
    obj.throttled();
    await sleep(60);
    check('this 透传', ctx === obj);

    // 用例3：cancel 取消待执行的尾部调用
    let cancellableCalls = 0;
    const cancellable = throttle(() => cancellableCalls++, 30);
    cancellable();         // 立即执行，共 1 次
    cancellable();         // 进入窗口，尾部待发
    cancellable.cancel();
    await sleep(60);
    check('cancel 取消待执行的尾部调用', cancellableCalls === 1);

    // 用例4：参数校验，非法输入抛 TypeError
    const throwsTypeError = (run) => {
      try {
        run();
        return false;
      } catch (err) {
        return err instanceof TypeError;
      }
    };
    check('fn 非函数抛 TypeError', throwsTypeError(() => throttle(123, 50)));
    check('wait 非法抛 TypeError', throwsTypeError(() => throttle(() => {}, -1)));

    // 用例5：flush 立即执行待发的尾部调用并返回结果
    const flushCalls = [];
    const flushable = throttle((v) => { flushCalls.push(v); return `r${v}`; }, 50);
    flushable(1);          // 立即执行
    const noPending = flushable.flush();
    check('无待发时 flush 不执行且返回 undefined', flushCalls.length === 1 && noPending === undefined);
    flushable(2);          // 进入窗口，尾部待发
    const flushed = flushable.flush();
    check('flush 立即执行待发的尾部调用', flushCalls.length === 2 && flushCalls[1] === 2);
    check('flush 返回 fn 的执行结果', flushed === 'r2');
    await sleep(60);       // flush 已清除定时器，不应再重复执行
    check('flush 后不再重复执行', flushCalls.length === 2);
    flushable(3);          // 距 flush 执行已超过 wait，正常立即执行
    check('flush 后超过 wait 再调用立即执行', flushCalls.length === 3 && flushCalls[2] === 3);

    if (failed > 0) process.exitCode = 1;
  })();
}

module.exports = throttle;
