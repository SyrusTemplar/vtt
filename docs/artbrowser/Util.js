"use strict";

String.prototype.uppercaseFirst = String.prototype.uppercaseFirst || function () {
	const str = this.toString();
	if (str.length === 0) return str;
	if (str.length === 1) return str.charAt(0).toUpperCase();
	return str.charAt(0).toUpperCase() + str.slice(1);
};

Array.prototype.last = Array.prototype.last || function () {
	return this[this.length - 1];
};

/**
 * Template strings which can contain jQuery objects.
 * Usage: $$`<div>Press this button: ${$btn}</div>`
 * @return jQuery
 */
window.$$ = function (parts, ...args) {
	if (parts instanceof jQuery) {
		return (...passed) => {
			const parts2 = [...passed[0]];
			const args2 = passed.slice(1);
			parts2[0] = `<div>${parts2[0]}`;
			parts2.last(`${parts2.last()}</div>`);

			const $temp = $$(parts2, ...args2);
			$temp.children().each((i, e) => $(e).appendTo(parts));
			return parts;
		};
	} else {
		const $eles = [];
		let ixArg = 0;

		const handleArg = (arg) => {
			if (arg instanceof $) {
				$eles.push(arg);
				return `<${arg.tag()} data-r="true"></${arg.tag()}>`;
			} else if (arg instanceof HTMLElement) {
				return handleArg($(arg));
			} else return arg
		};

		const raw = parts.reduce((html, p) => {
			const myIxArg = ixArg++;
			if (args[myIxArg] == null) return `${html}${p}`;
			if (args[myIxArg] instanceof Array) return `${html}${args[myIxArg].map(arg => handleArg(arg)).join("")}${p}`;
			else return `${html}${handleArg(args[myIxArg])}${p}`;
		});
		const $res = $(raw);

		if ($res.length === 1) {
			if ($res.attr("data-r") === "true") return $eles[0];
			else $res.find(`[data-r=true]`).replaceWith(i => $eles[i]);
		} else {
			// Handle case where user has passed in a bunch of elements with no outer wrapper
			const $tmp = $(`<div></div>`);
			$tmp.append($res);
			$tmp.find(`[data-r=true]`).replaceWith(i => $eles[i]);
			return $tmp.children();
		}

		return $res;
	}
};

$.fn.extend({
	// avoid setting input type to "search" as it visually offsets the contents of the input
	disableSpellcheck: function () { return this.attr("autocomplete", "new-password").attr("autocapitalize", "off").attr("spellcheck", "false"); },

	tag: function () {
		return this.prop("tagName").toLowerCase();
	},

	title: function (...args) { return this.attr("title", ...args); },

	/**
	 * Quickly set the innerHTML of the innermost element, wihtout parsing the whole thing with jQuery.
	 * Useful for populating e.g. a table row.
	 */
	fastSetHtml: function (html) {
		if (!this.length) return this;
		let tgt = this[0];
		while (tgt.children.length) {
			tgt = tgt.children[0];
		}
		tgt.innerHTML = html;
		return this;
	},

	hideVe: function () { return this.addClass("ve-hidden"); },
	showVe: function () { return this.removeClass("ve-hidden"); },
	toggleVe: function (val) {
		if (val === undefined) return this.toggleClass("ve-hidden", !this.hasClass("ve-hidden"));
		else return this.toggleClass("ve-hidden", !val);
	}
});

class SortUtil {
	static ascSort (a, b) {
		if (b === a) return 0;
		return b < a ? 1 : -1;
	}

	static ascSortLower (a, b) { return SortUtil.ascSort((a || "").toLowerCase(), (b || "").toLowerCase()) }
}

class MiscUtil {
	static copy (obj) {
		return JSON.parse(JSON.stringify(obj));
	}

	static pCopyTextToClipboard (text) {
		const $temp = $(`<textarea id="copy-temp" style="position: fixed; top: -1000px; left: -1000px; width: 1px; height: 1px;">${text}</textarea>`)
			.appendTo(document.body).select();
		document.execCommand("Copy");
		$temp.remove();
	}

	static showCopiedEffect ($ele, text = "Copied!") {
		const $temp = $(`<div class="copied-tip"><span>${text}</span></div>`)
			.appendTo(document.body);
		const top = $(window).scrollTop();
		const pos = $ele.offset();
		$temp
			.css({
				top: pos.top - $temp.height() - top,
				left: pos.left - ($temp.width() / 2) + ($ele.width() / 2)
			})
			.animate(
				{
					top: "-=8",
					opacity: 0.5
				},
				250,
				() => {
					$temp.remove();
				}
			);
	}

	static pDelay (msecs, resolveAs) {
		return new Promise(resolve => setTimeout(() => resolve(resolveAs), msecs));
	}

	/**
	 * Borrowed from lodash.
	 *
	 * @param func The function to debounce.
	 * @param wait Minimum duration between calls.
	 * @param options Options object.
	 * @return {Function} The debounced function.
	 */
	static debounce (func, wait, options) {
		let lastArgs; let lastThis; let maxWait; let result; let timerId; let lastCallTime; let lastInvokeTime = 0; let leading = false; let maxing = false; let trailing = true;

		wait = Number(wait) || 0;
		if (typeof options === "object") {
			leading = !!options.leading;
			maxing = "maxWait" in options;
			maxWait = maxing ? Math.max(Number(options.maxWait) || 0, wait) : maxWait;
			trailing = "trailing" in options ? !!options.trailing : trailing;
		}

		function invokeFunc (time) {
			let args = lastArgs; let thisArg = lastThis;

			lastArgs = lastThis = undefined;
			lastInvokeTime = time;
			result = func.apply(thisArg, args);
			return result;
		}

		function leadingEdge (time) {
			lastInvokeTime = time;
			timerId = setTimeout(timerExpired, wait);
			return leading ? invokeFunc(time) : result;
		}

		function remainingWait (time) {
			let timeSinceLastCall = time - lastCallTime; let timeSinceLastInvoke = time - lastInvokeTime; let result = wait - timeSinceLastCall;
			return maxing ? Math.min(result, maxWait - timeSinceLastInvoke) : result;
		}

		function shouldInvoke (time) {
			let timeSinceLastCall = time - lastCallTime; let timeSinceLastInvoke = time - lastInvokeTime;

			return (lastCallTime === undefined || (timeSinceLastCall >= wait) || (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
		}

		function timerExpired () {
			const time = Date.now();
			if (shouldInvoke(time)) {
				return trailingEdge(time);
			}
			// Restart the timer.
			timerId = setTimeout(timerExpired, remainingWait(time));
		}

		function trailingEdge (time) {
			timerId = undefined;

			if (trailing && lastArgs) return invokeFunc(time);
			lastArgs = lastThis = undefined;
			return result;
		}

		function cancel () {
			if (timerId !== undefined) clearTimeout(timerId);
			lastInvokeTime = 0;
			lastArgs = lastCallTime = lastThis = timerId = undefined;
		}

		function flush () {
			return timerId === undefined ? result : trailingEdge(Date.now());
		}

		function debounced () {
			let time = Date.now(); let isInvoking = shouldInvoke(time);
			lastArgs = arguments;
			lastThis = this;
			lastCallTime = time;

			if (isInvoking) {
				if (timerId === undefined) return leadingEdge(lastCallTime);
				if (maxing) {
					// Handle invocations in a tight loop.
					timerId = setTimeout(timerExpired, wait);
					return invokeFunc(lastCallTime);
				}
			}
			if (timerId === undefined) timerId = setTimeout(timerExpired, wait);
			return result;
		}

		debounced.cancel = cancel;
		debounced.flush = flush;
		return debounced;
	}

	// from lodash
	static throttle (func, wait, options) {
		let leading = true; let trailing = true;

		if (typeof options === "object") {
			leading = "leading" in options ? !!options.leading : leading;
			trailing = "trailing" in options ? !!options.trailing : trailing;
		}

		return this.debounce(func, wait, {leading, maxWait: wait, trailing});
	}
}

class StorageUtil {
	static _getSyncStorage () {
		if (StorageUtil._init) {
			if (StorageUtil.__fakeStorage) return StorageUtil._fakeStorage;
			else return window.localStorage;
		}

		StorageUtil._init = true;
		try {
			window.localStorage.setItem("_test_storage", true);
			return window.localStorage;
		} catch (e) {
			// if the user has disabled cookies, build a fake version
			StorageUtil.__fakeStorage = true;
			StorageUtil._fakeStorage = {
				isSyncFake: true,
				getItem: k => StorageUtil.__fakeStorage[k],
				removeItem: k => delete StorageUtil.__fakeStorage[k],
				setItem: (k, v) => StorageUtil.__fakeStorage[k] = v,
			};
			return StorageUtil._fakeStorage;
		}
	}

	// region Synchronous
	static syncGet (key) {
		const rawOut = StorageUtil._getSyncStorage().getItem(key);
		if (rawOut && rawOut !== "undefined" && rawOut !== "null") return JSON.parse(rawOut);
		return null;
	}

	static syncSet (key, value) {
		StorageUtil._getSyncStorage().setItem(key, JSON.stringify(value));
	}

	static syncRemove (key) {
		StorageUtil._getSyncStorage().removeItem(key);
	}
	// endregion
}
StorageUtil._init = false;
StorageUtil._fakeStorage = {};

export {SortUtil, MiscUtil, StorageUtil};
