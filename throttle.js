/**
 * 节流：连续调用时保证每隔 wait 毫秒最多执行一次
 * 默认首次调用立即执行，wait 期间内的调用被节流，窗口结束后补发最后一次调用
 * @param {Function} fn 需要节流的函数
 * @param {number} wait 间隔毫秒数
 * @param {Object} [options] 配置项
 * @param {boolean} [options.leading=true] 为 false 时不立即执行窗口开始时的调用
 * @param {boolean} [options.trailing=true] 为 false 时不补发窗口结束时的最后一次调用
 * @returns {Function} 节流后的函数：立即执行的调用透传 fn 的返回值，窗口内的调用无同步结果返回 undefined；
 *   带 cancel() 取消待执行的尾部调用、flush() 立即执行待发的尾部调用并返回结果
 * @throws {TypeError} fn 非函数、wait 非有限非负数或 options 非对象时抛出
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

  let previous = 0;      // 当前周期起点的毫秒时间戳，0 表示尚未开始
  let timer = null;      // 尾部补发的定时器
  let lastArgs = null;
  let lastThis = null;

  // 执行 fn 并以 at 为新周期起点，同时清理定时器与待发的尾部调用
  const invoke = function (thisArg, args, at) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    previous = at;
    lastArgs = lastThis = null;
    return fn.apply(thisArg, args);
  };

  const throttled = function (...args) {
    const now = Date.now();
    // leading:false 且尚未执行过时，以本次调用时刻为窗口起点，本次不立即执行
    if (previous === 0 && !leading) {
      previous = now;
    }
    const remaining = wait - (now - previous);

    if (remaining <= 0) {
      // 窗口外：立即执行并开启新周期
      return invoke(this, args, now);
    }

    // 窗口内：trailing:false 时直接丢弃本次调用
    if (!trailing) {
      return undefined;
    }

    // 窗口内：记录最后一次调用的参数，安排在窗口结束时补发
    lastArgs = args;
    lastThis = this;
    if (!timer) {
      timer = setTimeout(() => {
        // 以预定触发点作为新周期起点，消除定时器延迟造成的累积漂移
        invoke(lastThis, lastArgs, previous + wait);
      }, remaining);
    }
    return undefined;
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
    // flush 是手动提前触发，从真实执行时刻开启新窗口
    return invoke(lastThis, lastArgs, Date.now());
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
