/**
 * 节流：连续调用时保证每隔 wait 毫秒最多执行一次
 * 默认首次调用立即执行，wait 期间内的调用被节流，窗口结束后补发最后一次调用
 * @param {Function} fn 需要节流的函数
 * @param {number} wait 间隔毫秒数
 * @param {Object} [options] 配置项
 * @param {boolean} [options.leading=true] 为 false 时首个周期的首次调用不立即执行
 * @param {boolean} [options.trailing=true] 为 false 时不补发窗口结束时的最后一次调用
 * @returns {Function} 节流后的函数：立即执行的调用透传 fn 的返回值，窗口内的调用无同步结果返回 undefined；
 *   带 cancel() 取消待执行的尾部调用、flush() 立即执行待发的尾部调用并返回结果
 * @throws {TypeError} fn 非函数、wait 非有限非负数或 options 非对象时抛出
 *
 * 实现说明：时间戳判断 + 定时器补发——调用时用 shouldInvoke 判断是否脱离上一执行周期，
 * 周期外立即执行（leading:false 的首次调用仅记为周期起点），周期内只记录最后一次调用的参数；
 * 定时器到点在周期边界补发，连续调用时定时器只安排不重建，补发以周期边界为新起点消除累积漂移。
 */
function throttle(fn, wait, options) {
  if (typeof fn !== 'function') {
    throw new TypeError('throttle 的第一个参数必须是函数');
  }
  if (typeof wait !== 'number' || !Number.isFinite(wait) || wait < 0) {
    throw new TypeError('throttle 的第二个参数必须是有限的非负数');
  }
  if (options === undefined) {
    options = {};
  } else if (options === null || typeof options !== 'object') {
    throw new TypeError('throttle 的第三个参数必须是对象');
  }
  // 仅当显式传 false 时关闭对应行为
  const leading = options.leading !== false;
  const trailing = options.trailing !== false;

  let timerId = null;       // 补发定时器，null 表示当前周期没有安排补发
  let lastArgs = null;      // 最后一次调用的参数，null 表示没有待发的调用
  let lastThis = null;
  let lastInvokeTime = 0;   // 上次执行 fn 的毫秒时间戳，0 表示尚未开始

  // 执行 fn，清空待发状态，并以 time 作为新周期起点
  const invokeFunc = function (time) {
    const args = lastArgs;
    const thisArg = lastThis;
    lastArgs = lastThis = null;
    lastInvokeTime = time;
    return fn.apply(thisArg, args);
  };

  // time 时刻是否已脱离上一个执行周期：距上次执行满 wait（首次或时钟回拨视为满足）


  // 补发定时器到点：以周期边界为新周期起点补发最后一次调用，消除定时器延迟造成的累积漂移
  const timerExpired = function () {
    timerId = null;
    if (lastArgs !== null) {
      return invokeFunc(lastInvokeTime + wait);
    }
    return undefined;
  };

  const throttled = function (...args) {
    const time = Date.now();

    if (shouldInvoke(time)) {
      lastArgs = args;
      lastThis = this;
      // 首次调用且 leading:false：以本次调用为周期起点，本次不立即执行
      // （wait 为 0 时窗口长度为零，仍立即执行）
      if (lastInvokeTime === 0 && !leading && wait > 0) {
        if (trailing) {
          timerId = setTimeout(timerExpired, wait);
        }
        return undefined;
      }
      // 周期外：立即执行并开启新周期
      return invokeFunc(time);
    }

    // 周期内：trailing:false 时直接丢弃本次调用
    if (!trailing) {
      return undefined;
    }
    // 周期内：记录最后一次调用的参数，安排在周期边界补发
    lastArgs = args;
    lastThis = this;
    if (timerId === null) {
      timerId = setTimeout(timerExpired, wait - (time - lastInvokeTime));
    }
    return undefined;
  };

  // 手动取消尚未执行的尾部调用，状态完全复位
  throttled.cancel = function () {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = null;
    lastArgs = lastThis = null;
    lastInvokeTime = 0;
  };

  // 立即执行待发的尾部调用并返回其结果，无待发时不动作返回 undefined
  throttled.flush = function () {
    if (timerId === null || lastArgs === null) {
      return undefined;
    }
    clearTimeout(timerId);
    timerId = null;
    // flush 是手动提前触发，从真实执行时刻开启新周期
    return invokeFunc(Date.now());
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

    // 用例6：立即执行的调用透传 fn 的返回值，窗口内的调用无同步结果
    const returnable = throttle((v) => `r${v}`, 50);
    check('立即执行透传 fn 返回值', returnable(1) === 'r1');
    check('窗口内调用返回 undefined', returnable(2) === undefined);
    await sleep(70);       // 等尾部补发完成，不干扰后续用例

    // 用例7：leading: false 时首次调用不立即执行，窗口结束补发
    const leadingCalls = [];
    const noLeading = throttle((v) => leadingCalls.push(v), 40, { leading: false });
    noLeading(1);
    check('leading:false 首次调用不立即执行', leadingCalls.length === 0);
    await sleep(70);       // t≈70ms，远超 wait=40ms 的窗口
    check('leading:false 窗口结束补发首次调用', leadingCalls.length === 1 && leadingCalls[0] === 1);

    // 用例8：trailing: false 时窗口内的调用被丢弃
    const trailingCalls = [];
    const noTrailing = throttle((v) => trailingCalls.push(v), 40, { trailing: false });
    noTrailing(1);         // 首次调用立即执行
    check('trailing:false 首次调用立即执行', trailingCalls.length === 1 && trailingCalls[0] === 1);
    noTrailing(2);         // 窗口内，被丢弃，不安排补发
    await sleep(70);
    check('trailing:false 窗口内调用被丢弃', trailingCalls.length === 1);
    noTrailing(3);         // 距上次执行已超过 wait，立即执行
    check('trailing:false 窗口外立即执行', trailingCalls.length === 2 && trailingCalls[1] === 3);

    // 用例9：options 非法时抛 TypeError
    check('options 非对象抛 TypeError', throwsTypeError(() => throttle(() => {}, 50, null)));

    if (failed > 0) process.exitCode = 1;
  })();
}

module.exports = throttle;
