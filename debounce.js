/**
 * 防抖：连续调用时只执行最后一次，停止调用 wait 毫秒后才触发
 * @param {Function} fn 需要防抖的函数
 * @param {number} wait 等待毫秒数
 * @param {Object} [options] 配置项
 * @param {boolean} [options.leading=false] 为 true 时静默期外的首次调用立即执行
 * @param {boolean} [options.trailing=true] 为 false 时不补发静默期结束时的最后一次调用
 * @returns {Function} 防抖后的函数：leading 立即执行的调用透传 fn 的返回值，其余调用无同步结果返回 undefined；
 *   带 cancel() 取消待执行的调用、flush() 立即执行待发的调用并返回结果
 * @throws {TypeError} fn 非函数、wait 非有限非负数或 options 非对象时抛出
 *
 * 实现说明：时间戳驱动——调用只记录 lastCallTime 与参数，不重置定时器；
 * 定时器到点时用 shouldInvoke 检查静默期是否已满，未满则按剩余时间续约。
 * 相比"每次调用 clearTimeout/setTimeout"，连续调用时定时器只续约不重建。
 */
function debounce(fn, wait, options) {
  if (typeof fn !== 'function') {
    throw new TypeError('debounce 的第一个参数必须是函数');
  }
  if (typeof wait !== 'number' || !Number.isFinite(wait) || wait < 0) {
    throw new TypeError('debounce 的第二个参数必须是有限的非负数');
  }
  if (options === undefined) {
    options = {};
  } else if (options === null || typeof options !== 'object') {
    throw new TypeError('debounce 的第三个参数必须是对象');
  }
  // leading 仅当显式传 true 时开启；trailing 仅当显式传 false 时关闭
  const leading = options.leading === true;
  const trailing = options.trailing !== false;

  let timerId = null;   // 当前定时器，null 表示没有挂起的到点检查
  let lastArgs = null;  // 最后一次调用的参数，null 表示没有待发的调用
  let lastThis = null;
  let lastCallTime;     // 最后一次调用 debounced 的毫秒时间戳
  let lastInvokeTime;   // 序列起点的毫秒时间戳（新序列开启或实际执行 fn 的时刻）

  // 执行 fn，清空待发状态，并以 time 作为新序列起点
  const invokeFunc = function (time) {
    const args = lastArgs;
    const thisArg = lastThis;
    lastArgs = lastThis = null;
    lastInvokeTime = time;
    return fn.apply(thisArg, args);
  };

  // time 时刻是否已脱离静默期：距上次调用与距上次序列起点均满 wait（首次调用或时钟回拨视为满足）
  const shouldInvoke = function (time) {
    const sinceCall = time - lastCallTime;
    const sinceInvoke = time - lastInvokeTime;
    return (lastCallTime === undefined || sinceCall >= wait || sinceCall < 0) &&
      (lastInvokeTime === undefined || sinceInvoke >= wait);
  };

  // 定时器到点：静默期已满则补发最后一次调用，否则按距上次调用满 wait 的剩余时间续约
  const timerExpired = function () {
    const time = Date.now();
    if (shouldInvoke(time)) {
      timerId = null;
      if (trailing && lastArgs) {
        return invokeFunc(time);
      }
      lastArgs = lastThis = null;
      return undefined;
    }
    timerId = setTimeout(timerExpired, wait - (time - lastCallTime));
  };

  const debounced = function (...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking && timerId === null) {
      // 静默期外：开启新序列，以本次调用时刻为序列起点。
      // leading 为 true 时本次调用立即执行并透传返回值，否则仅等待尾部补发
      lastInvokeTime = time;
      timerId = setTimeout(timerExpired, wait);
      if (leading) {
        return invokeFunc(time);
      }
    }
    // 静默期内的调用：参数已记录，交由定时器到点后补发，无同步结果
    return undefined;
  };

  // 手动取消尚未执行的调用，状态完全复位
  debounced.cancel = function () {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = null;
    lastArgs = lastThis = null;
    lastCallTime = lastInvokeTime = undefined;
  };

  // 立即执行待发的调用并返回其结果，无待发时不动作返回 undefined
  debounced.flush = function () {
    if (timerId === null || lastArgs === null || !trailing) {
      return undefined;
    }
    clearTimeout(timerId);
    timerId = null;
    // flush 是手动提前触发，从真实执行时刻开启新序列
    return invokeFunc(Date.now());
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
    await sleep(25);       // 25ms 时再调一次，静默期未满应续约定时器
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
    check('options 非对象抛 TypeError', throwsTypeError(() => debounce(() => {}, 50, null)));

    // 用例5：leading:true 静默期外首次调用立即执行，静默期内调用停止后补发
    const leadingCalls = [];
    const leadingDebounced = debounce((v) => leadingCalls.push(v), 40, { leading: true });
    leadingDebounced(1);
    check('leading:true 首次调用立即执行', leadingCalls.length === 1 && leadingCalls[0] === 1);
    leadingDebounced(2);   // 静默期内，仅记录参数等待补发
    await sleep(100);      // 补发在静默期结束后发生（t≈40ms），此后距上次执行已满 wait
    check('leading:true 停止后补发最后一次调用', leadingCalls.length === 2 && leadingCalls[1] === 2);
    leadingDebounced(3);   // 距上次执行已超过 wait，再次立即执行
    check('leading:true 静默期外再次立即执行', leadingCalls.length === 3 && leadingCalls[2] === 3);

    // 用例6：leading 立即执行的调用透传 fn 返回值，静默期内的调用无同步结果
    const returnable = debounce((v) => `r${v}`, 40, { leading: true });
    check('leading 立即执行透传 fn 返回值', returnable(1) === 'r1');
    check('静默期内调用返回 undefined', returnable(2) === undefined);
    await sleep(70);       // 等补发完成，不干扰后续用例

    // 用例7：leading:true 且 trailing:false 时静默期内的调用被丢弃
    const dropCalls = [];
    const drop = debounce((v) => dropCalls.push(v), 40, { leading: true, trailing: false });
    drop(1);               // 立即执行
    check('trailing:false 首次调用立即执行', dropCalls.length === 1);
    drop(2);               // 静默期内，被丢弃，不安排补发
    await sleep(70);       // 定时器到点只解除静默，不执行
    check('trailing:false 静默期内调用被丢弃', dropCalls.length === 1);
    drop(3);               // 距上次执行已超过 wait，立即执行
    check('trailing:false 静默期外立即执行', dropCalls.length === 2 && dropCalls[1] === 3);

    // 用例8：flush 立即执行待发的调用并返回结果
    const flushCalls = [];
    const flushable = debounce((v) => { flushCalls.push(v); return `r${v}`; }, 50);
    const noPending = flushable.flush();
    check('无待发时 flush 不执行且返回 undefined', flushCalls.length === 0 && noPending === undefined);
    flushable(1);          // 进入静默期，调用待发
    const flushed = flushable.flush();
    check('flush 立即执行待发的调用', flushCalls.length === 1 && flushCalls[0] === 1);
    check('flush 返回 fn 的执行结果', flushed === 'r1');
    await sleep(70);       // flush 已清除定时器，不应再重复执行
    check('flush 后不再重复执行', flushCalls.length === 1);
    flushable(2);          // 距 flush 执行已超过 wait，正常防抖
    await sleep(70);
    check('flush 后可正常再次防抖', flushCalls.length === 2 && flushCalls[1] === 2);

    if (failed > 0) process.exitCode = 1;
  })();
}

module.exports = debounce;
