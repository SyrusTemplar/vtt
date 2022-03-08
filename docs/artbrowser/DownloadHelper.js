class DownloadHelper {
	constructor ($parent) {
		this._$parent = $parent;
		this._queue = [];
		this._$wrpDlBar = null;
	}

	_doDisplayProgressBar ($content, cbCancel) {
		if (this._$wrpDlBar) this._$wrpDlBar.remove();

		const $wrpContent = $$`<div class="artr__dl_bar-wrp-content">${$content}</div>`;

		const $btnCancelClose = $(`<button class="artr__dl_bar-btn-close px-2"><span class="fas fa-times"/></button>`)
			.click(() => {
				this._$wrpDlBar.remove();
				cbCancel();
			});

		this._$wrpDlBar = $$`<div class="artr__dl_bar flex">
			${$wrpContent}
			<div class="artr__dl_bar-wrp-control">
				${$btnCancelClose}
			</div>
		</div>`
			.appendTo(this._$parent);

		return $wrpContent;
	}

	/**
	 * @param $wrpBarContent
	 * @param str
	 * @param [opts]
	 * @param [opts.isError]
	 * @param [opts.isComplete]
	 */
	async _pDoUpdateProgressBar ($wrpBarContent, str, opts) {
		opts = opts || {};
		if (opts.isError) $wrpBarContent.parent().addClass("artr__dl_bar--error");
		$wrpBarContent.html(str);
		if (opts.isComplete) return this._pDoUpdateQueueAndTriggerNext();
	}

	_doAjaxGet (url) {
		const xhr = new XMLHttpRequest();
		const p = new Promise((resolve, reject) => {
			// FIXME cors-anywhere has a usage limit, which is pretty easy to hit when downloading many files
			xhr.open("GET", `https://cors-anywhere.herokuapp.com/${url}`, true);
			xhr.responseType = "arraybuffer";

			let lastContentType = null;

			xhr.onreadystatechange = () => {
				const contentType = xhr.getResponseHeader("content-type");
				if (contentType) lastContentType = contentType;
			};

			xhr.onload = function () {
				const arrayBuffer = xhr.response;
				resolve({buff: arrayBuffer, contentType: lastContentType});
			};

			xhr.onerror = (e) => reject(new Error(`Error during request: ${e}`));

			xhr.send();
		});

		p.abort = () => xhr.abort();

		return p;
	}

	async _pDoUpdateQueueAndTriggerNext () {
		this._queue.shift();
		if (this._queue.length) return this._pDoNextDownload();
	}

	async _pDoNextDownload () {
		const item = this._queue[0];

		let isCancelled = false;
		let downloadTasks = [];

		const $wrpProgressBar = this._doDisplayProgressBar(
			`Download starting...`,
			() => {
				isCancelled = true;
				downloadTasks.forEach(p => {
					try { p.abort(); } catch (ignored) { /* Do nothing */ }
				});
				this._queue.shift();
				if (this._queue.length) this._pDoNextDownload();
			});

		if (isCancelled) return;

		try {
			const toSave = [];
			let downloaded = 0;
			let errorCount = 0;

			const getWrappedPromise = dataItem => {
				const pAjax = this._doAjaxGet(dataItem.uri);

				const p = (async () => {
					try {
						const data = await pAjax;
						toSave.push(data);
					} catch (e) {
						setTimeout(() => { throw e; });
						++errorCount;
					}
					++downloaded;
					this._pDoUpdateProgressBar(
						$wrpProgressBar,
						`Downloading ${downloaded}/${item.data.length}... (${Math.floor(100 * downloaded / item.data.length)}%)${errorCount ? ` (${errorCount} error${errorCount === 1 ? "" : "s"})` : ""}`
					);
				})();

				p.abort = () => pAjax.abort();

				return p;
			};

			downloadTasks = item.data.map(dataItem => getWrappedPromise(dataItem));
			await Promise.all(downloadTasks);

			if (isCancelled) return;

			this._pDoUpdateProgressBar($wrpProgressBar, `Building ZIP...`);

			const zip = new JSZip();
			toSave.forEach((data, i) => {
				const extension = (data.contentType || "unknown").split("/").last();
				zip.file(`${`${i}`.padStart(3, "0")}.${extension}`, data.buff, {binary: true});
			});

			if (isCancelled) return;

			zip.generateAsync({type: "blob"})
				.then((content) => {
					if (isCancelled) return;

					this._pDoUpdateProgressBar($wrpProgressBar, `Downloading ZIP...`);
					const filename = item.set && item.artist
						? `${item.set}__${item.artist}`
						: "bulk-images";
					DownloadHelper.saveAs(content, DownloadHelper._sanitizeFilename(filename));
					this._pDoUpdateProgressBar(
						$wrpProgressBar,
						`Download complete.`,
						{isComplete: true}
					);
				});
		} catch (e) {
			setTimeout(() => { throw e; })
			this._pDoUpdateProgressBar(
				$wrpProgressBar,
				`Download failed! Error was: ${e.message} (check the log for more information).`,
				{isError: true}
			);
			this._pDoUpdateQueueAndTriggerNext();
		}
	}

	async downloadZip (...items) {
		if (items.length === 1) this._queue.push(items[0]);
		else {
			const fakeItem = {data: items.map(it => it.data).flat()};
			this._queue.push(fakeItem);
		}

		if (this._queue.length === 1) await this._pDoNextDownload();
	}

	async downloadUrls (...items) {
		const filename = items.length === 1
			? `${items[0].set}__${items[0].artist}`
			: `bulk-urls`;

		const contents = items.map(it => it.data).flat().map(it => it.uri).join("\n");
		const blob = new Blob([contents], {type: "text/plain"});
		DownloadHelper.saveAs(blob, DownloadHelper._sanitizeFilename(filename));
	}

	async downloadJson (...items) {
		const filename = items.length === 1
			? `${items[0].set}__${items[0].artist}`
			: `bulk-jsons`;

		const asJson = items.map(it => ({
			artist: it.artist,
			set: it.set,
			uris: it.data.map(it => it.uri)
		}));

		const contents = JSON.stringify(asJson, null, "\t");
		const blob = new Blob([contents], {type: "application/json"});
		DownloadHelper.saveAs(blob, DownloadHelper._sanitizeFilename(filename));
	}

	static _sanitizeFilename (str) {
		return str.trim().replace(/[^\w-]/g, "_");
	}
}

/* eslint-disable */
// based on:
/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/src/FileSaver.js */
DownloadHelper.saveAs = function () {
	const view = window;
	let
		doc = view.document
		// only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function () {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function (node) {
			let event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, is_safari = /constructor/i.test(view.HTMLElement) || view.safari
		, is_chrome_ios = /CriOS\/[\d]+/.test(navigator.userAgent)
		, setImmediate = view.setImmediate || view.setTimeout
		, throw_outside = function (ex) {
			setImmediate(function () {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		, arbitrary_revoke_timeout = 1000 * 40 // in ms
		, revoke = function (file) {
			let revoker = function () {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
		, dispatch = function (filesaver, event_types, event) {
			event_types = [].concat(event_types);
			let i = event_types.length;
			while (i--) {
				let listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function (blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			// note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob([String.fromCharCode(0xFEFF), blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function (blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			let
				filesaver = this
				, type = blob.type
				, force = type === force_saveable_type
				, object_url
				, dispatch_all = function () {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function () {
					if ((is_chrome_ios || (force && is_safari)) && view.FileReader) {
						// Safari doesn't allow downloading of blob urls
						let reader = new FileReader();
						reader.onloadend = function () {
							let url = is_chrome_ios ? reader.result : reader.result.replace(/^data:[^;]*;/, 'data:attachment/file;');
							let popup = view.open(url, '_blank');
							if (!popup) view.location.href = url;
							url = undefined; // release reference before dispatching
							filesaver.readyState = filesaver.DONE;
							dispatch_all();
						};
						reader.readAsDataURL(blob);
						filesaver.readyState = filesaver.INIT;
						return;
					}
					// don't create more object URLs than needed
					if (!object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (force) {
						view.location.href = object_url;
					} else {
						let opened = view.open(object_url, "_blank");
						if (!opened) {
							// Apple does not allow window.open, see https://developer.apple.com/library/safari/documentation/Tools/Conceptual/SafariExtensionGuide/WorkingwithWindowsandTabs/WorkingwithWindowsandTabs.html
							view.location.href = object_url;
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				};
			filesaver.readyState = filesaver.INIT;

			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setImmediate(function () {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				}, 0);
				return;
			}

			fs_error();
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function (blob, name, no_auto_bom) {
			return new FileSaver(blob, name || blob.name || "download", no_auto_bom);
		};
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function (blob, name, no_auto_bom) {
			name = name || blob.name || "download";

			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name);
		};
	}
	FS_proto.abort = function () {};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;
	FS_proto.error =
		FS_proto.onwritestart =
			FS_proto.onprogress =
				FS_proto.onwrite =
					FS_proto.onabort =
						FS_proto.onerror =
							FS_proto.onwriteend =
								null;

	return saveAs;
}();
/* eslint-enable */

export {DownloadHelper};
