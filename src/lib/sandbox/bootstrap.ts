/**
 * The bootstrap script injected as the first element in the sandboxed iframe.
 * It wires up error capture (window.onerror, unhandledrejection, console
 * error/warn) and a post-load "blank render" check, then posts everything back
 * to the parent window via postMessage.
 *
 * Kept as a plain string (not a module) because it runs inside the iframe's
 * own realm, not the app bundle. `__SANDBOX_CHANNEL__` is a shared tag so the
 * parent can ignore unrelated messages.
 */

export const SANDBOX_CHANNEL = 'ollama-webui-sandbox';

/** The bootstrap source, parameterized by the channel + a per-run id. */
export function buildBootstrap(runId: string): string {
  return `(function () {
  var CH = ${JSON.stringify(SANDBOX_CHANNEL)};
  var RUN = ${JSON.stringify(runId)};
  var issues = [];
  function send(type, payload) {
    try {
      parent.postMessage({ __ch: CH, runId: RUN, type: type, payload: payload }, '*');
    } catch (e) {}
  }
  function push(kind, message) {
    if (!message) return;
    var text = String(message);
    if (text.length > 2000) text = text.slice(0, 2000) + '…';
    issues.push({ kind: kind, message: text });
    send('issue', { kind: kind, message: text });
  }

  window.onerror = function (msg, src, line, col, err) {
    var detail = (err && err.stack) ? err.stack : msg;
    if (line) detail += ' (line ' + line + ')';
    push('error', detail);
    return false;
  };
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev && ev.reason;
    push('error', (r && r.stack) ? r.stack : (r && r.message) ? r.message : String(r));
  });

  var origError = console.error;
  console.error = function () {
    push('console-error', Array.prototype.join.call(arguments, ' '));
    try { origError.apply(console, arguments); } catch (e) {}
  };
  var origWarn = console.warn;
  console.warn = function () {
    push('console-warn', Array.prototype.join.call(arguments, ' '));
    try { origWarn.apply(console, arguments); } catch (e) {}
  };

  function finish() {
    // Blank-render detection: after scripts have had a moment to run, is there
    // any visible content? An empty/whitespace body with no sized elements is
    // reported as a blank render so the heal loop can react to a white screen.
    var blank = false;
    try {
      var body = document.body;
      var text = body ? (body.innerText || '').trim() : '';
      var hasVisual = body ? body.querySelector('img,canvas,svg,video,input,button,table,ul,ol,[style*="background"]') : null;
      var painted = body ? (body.getBoundingClientRect().height > 4) : false;
      blank = !text && !hasVisual && !painted;
    } catch (e) {}
    send('done', { blank: blank });
  }

  if (document.readyState === 'complete') {
    setTimeout(finish, 400);
  } else {
    window.addEventListener('load', function () { setTimeout(finish, 400); });
  }
})();`;
}
