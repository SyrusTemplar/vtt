"use strict";

import {Const} from "./Const.js";
import {MiscUtil, SortUtil, StorageUtil} from "./Util.js";
import {DownloadHelper} from "./DownloadHelper.js";

class ArtBrowser {
	static async pGetJson (url) {
		if (ArtBrowser._JSON_FETCHING[url]) {
			await ArtBrowser._JSON_FETCHING[url];
			return ArtBrowser._JSON_CACHE[url];
		}

		ArtBrowser._JSON_FETCHING[url] = (async () => {
			const response = await fetch(url);
			ArtBrowser._JSON_CACHE[url] = await response.json();
		})();

		await ArtBrowser._JSON_FETCHING[url];
		return ArtBrowser._JSON_CACHE[url];
	}

	static _searchFeatures (searchTerm, item, doLowercase) {
		// features are lowercase in index
		return (item.features || []).some(x => (doLowercase ? x.toLowerCase() : x).includes(searchTerm));
	}

	static _filterProps (filters, item) {
		if (Object.keys(filters).length) {
			const missingOrUnwanted = Object.keys(filters).find(prop => {
				if (!item[prop]) return true;
				const requiredVals = Object.keys(filters[prop]).filter(k => filters[prop][k]);
				const missingEnum = !!requiredVals.find(x => !item[prop].includes(x));
				const excludedVals = Object.keys(filters[prop]).filter(k => !filters[prop][k]);
				const unwantedEnum = !!excludedVals.find(x => item[prop].includes(x));
				return missingEnum || unwantedEnum;
			});
			if (missingOrUnwanted) return false;
		}
		return true;
	}

	static _filterFakeProps (filterStorage, item, filterProp, prop) {
		const filterState = filterStorage[filterProp];
		const key = item[prop];

		// There can only be one artist or set (the two "fake" filter properties) per item, so return true if:
		//  - the entire filter is white (i.e. the filter is inactive)
		//  - our value is blue (i.e. the filter is inactive, but our value is selected)
		if (filterState && Object.keys(filterState).length) return filterState[key];
		else return true;
	}

	constructor ($parent) {
		this._$parent = $parent.addClass("artr__wrp");
		this._downloadHelper = new DownloadHelper($parent);

		this._index = null;

		this._currentItem = null;
		this._currentIndexItem = null;
		this._search = "";

		this._itemMetas = null;

		this._filtersArtists = {};
		this._filtersSets = {};
		this._filters = {};

		this._itemObservers = [];

		this._$sideBody = null;
		this._$mainBody = null;
		this._$mainHeaderElements = null;
		this._$mainBodyInner = null;
		this._$itemBody = null;
		this._$itemBodyInner = null;
		this._$wrpBread = null;
	}

	_handleHashChange () {
		const key = window.location.hash.slice(1);
		if (key && this._index[key]) {
			const indexItem = this._index[key];

			ArtBrowser.pGetJson(`${Const.GH_PATH}${indexItem._key}.json`)
				.then(file => {
					this._currentItem = file;
					this._currentIndexItem = indexItem;
					this._doRenderItem(true);
				});
		} else {
			this._doRenderIndex();
		}
	}

	_updateCrumbs () {
		this._$wrpBread.empty();
		const $txtIndex = $(`<a href="#" class="artr__crumb">Index</a>`)
			.appendTo(this._$wrpBread);

		if (this._currentItem) {
			const $txtSlash = $(`<span class="artr__crumb--sep">/</span>`).appendTo(this._$wrpBread);
			const $txtItem = $(`<a href="#${this._currentIndexItem._key}" class="artr__crumb">${this._currentItem.set} \u2013 ${this._currentItem.artist}</a>`)
				.appendTo(this._$wrpBread);
		}
	}

	/**
	 * Convert a search string of the form `"ship" "sea" "black powder"` to `["ship", "sea", "black powder"]`
	 */
	_getSearchTerms () {
		const str = this._search.toLowerCase().trim();

		const len = str.length;
		const out = [];
		let stack = "";
		let inQuotes = false;

		for (let i = 0; i < len; ++i) {
			const c = str[i];
			switch (c) {
				case `"`: {
					if (inQuotes && stack && stack.trim()) {
						out.push(stack.trim());
						stack = "";
					}
					inQuotes = !inQuotes;
					break;
				}
				default: stack += c;
			}
		}

		// handle remaining output
		if (stack && stack.trim()) out.push(stack.trim());

		return out;
	}

	_applyFilterAndSearchToIndex () {
		this._search = this._search.toLowerCase();

		// require the user to search or apply a filter before displaying any results
		if (Object.keys(this._filtersArtists).length === 0
			&& Object.keys(this._filtersSets).length === 0
			&& Object.keys(this._filters).length === 0
			&& this._search.replace(/"/g, "").length < 2) return [];

		return Object.values(this._index).filter(it => {
			if (this._search) {
				const searchTerms = this._getSearchTerms();

				const lowerSet = it._set.toLowerCase();
				const isSetMatch = searchTerms.every(srch => lowerSet.includes(srch))

				const lowerArtist = it._artist.toLowerCase();
				const isArtistMatch = searchTerms.every(srch => lowerArtist.includes(srch));

				const isFeatureMatch = searchTerms.every(srch => ArtBrowser._searchFeatures(srch, it));

				if (!isSetMatch && !isArtistMatch && !isFeatureMatch) return false;
			}
			if (!ArtBrowser._filterFakeProps(this._filtersArtists, it, Const.FAKE_FILTER_ARTIST, "_artist")) return false;
			if (!ArtBrowser._filterFakeProps(this._filtersSets, it, Const.FAKE_FILTER_SET, "_set")) return false;
			if (!ArtBrowser._filterProps(this._filters, it)) return false;
			return true;
		});
	}

	_doRenderIndex () {
		const indexSlice = this._applyFilterAndSearchToIndex();

		this._currentItem = false;
		this._currentIndexItem = false;
		this._$mainBody.showVe();
		(this._$mainHeaderElements || []).forEach(it => it.showVe())
		this._$itemBody.hideVe();
		this._$mainBodyInner.empty();
		this._itemMetas = null;
		this._updateCrumbs();

		if (!indexSlice.length) {
			$(`<div class="artr__no_results_wrp"><div class="artr__no_results"><div class="text-center"><span class="artr__no_results_headline">No results found</span><br>Please adjust the filters (on the left) or refine your search (above).</div></div></div>`)
				.appendTo(this._$mainBodyInner);
		} else {
			this._itemMetas = indexSlice.map(it => {
				const $cbSel = $(`<input type="checkbox" class="mr-2 artr__item__cb-select">`)
					.change(() => {
						$itemBottom.toggleClass("artr__item__bottom--selected", $cbSel.prop("checked"));
					});

				let isExpanded = false;
				const $btnToggleExpanded = $(`<div class="clickable mr-2 artr__item__btn-toggle-expand">[+]</div>`)
					.click(() => {
						isExpanded = !isExpanded;
						$btnToggleExpanded.toggleClass("active", isExpanded);
						$itemTop.toggleClass("artr__item__top--expanded", isExpanded);
						$btnToggleExpanded.text(isExpanded ? "[\u2013]" : "[+]");
					});

				const $dispName = $(`<div class="clickable mr-2">${it._set} <i>by</i> ${it._artist} (${it._size.toLocaleString()} images)</div>`)
					.click(() => $cbSel.prop("checked", !$cbSel.prop("checked")));

				const $itemBottom = $$`<div class="artr__item__bottom flex-v-center">
					${$cbSel}
					${$btnToggleExpanded}
					${$dispName}
					<a href="#${it._key}" class="artr__item__lnk-view">View</a>
				</div>`;

				// Alternate version--avoid using this, as it just wastes bandwidth
				// ${it._sample.map(sample => `<img class="artr__item__thumbnail" src="${Const.GH_PATH}${it._key}--thumb-${sample}.jpg">`).join("")}
				const $itemTop = $(`<div class="artr__item__top"><img src="${Const.IMG_LAZY_180}"></div>`);

				const $item = $$`<div class="artr__item flex-col">
					${$itemBottom}
					${$itemTop}
				</div>`
					.appendTo(this._$mainBodyInner);

				return {
					$item,
					$cbSel,
					fnHandleChangeCbAll: value => $itemBottom.toggleClass("artr__item__bottom--selected", value),
					key: it._key,
					fnOnIntersect: this._loadItemThumbnails.bind(this, $itemTop, it._key)
				};
			});

			this._addScrollHandlers();
		}
	}

	_loadItemThumbnails ($itemTop, key) {
		const indexItem = this._index[key];

		ArtBrowser.pGetJson(`${Const.GH_PATH}${indexItem._key}.json`)
			.then(file => {
				$itemTop.empty();

				const intersectionMetas = [];

				file.data
					.sort((a, b) => SortUtil.ascSortLower(a.uri, b.uri))
					.forEach(it => {
						const $img = $(`<img class="artr__item__thumbnail" src="${Const.IMG_LAZY_180}">`);
						const urlThumb = `${Const.GH_PATH}${indexItem._key}--thumb-${it.hash}.jpg`;

						const $btnCopyUrl = $(`<div class="artr__item__menu_item" title="Copy URL"><span class="fas fa-link"></span></div>`)
							.click(async (evt) => {
								evt.stopPropagation();
								evt.preventDefault();

								await MiscUtil.pCopyTextToClipboard(it.uri);
								MiscUtil.showCopiedEffect($btnCopyUrl, "Copied URL!");
							});

						const $btnSupport = it.support
							? $(`<a class="artr__item__menu_item" href="${it.support}" target="_blank" title="Support Artist"><span class="fas fa-shopping-cart"></span></a>`)
							: null;

						const $lnk = $$`<a href="${it.uri}" target="_blank" class="artr__item__lnk-fullsize" draggable="true">${$img}</a>`
							.on("dragstart", evt => {
								const meta = {
									type: "ve-Art",
									uri: it.uri
								};
								evt.originalEvent.dataTransfer.setData("application/json", JSON.stringify(meta));
							});

						$$`<div class="artr__item__wrp relative">
							${$lnk}
							<div class="artr__item__menu">${$btnCopyUrl}${$btnSupport}</div>
						</div>`
							.appendTo($itemTop);

						intersectionMetas.push({eleImg: $img[0], urlThumb});
					});

				this._addHorizontalScrollHandler(intersectionMetas);
			});
	}

	_doRenderItem (resetScroll) {
		this._$mainBody.hideVe();
		(this._$mainHeaderElements || []).forEach(it => it.hideVe())
		this._$itemBody.showVe();
		this._$itemBodyInner.empty();
		this._updateCrumbs();
		if (resetScroll) this._$itemBodyInner.scrollTop(0);

		const $eles = this._currentItem.data
			.sort((a, b) => SortUtil.ascSortLower(a.uri, b.uri))
			.map(it => {
				const urlThumb = `${Const.GH_PATH}${this._currentIndexItem._key}--thumb-${it.hash}.jpg`;

				const $btnCopyUrl = $(`<div class="artr__item__menu_item" title="Copy URL"><span class="fas fa-link"></span></div>`)
					.click(async (evt) => {
						evt.stopPropagation();
						evt.preventDefault();

						await MiscUtil.pCopyTextToClipboard(it.uri);
						MiscUtil.showCopiedEffect($btnCopyUrl, "Copied URL!");
					});

				const $btnSupport = it.support
					? $(`<a class="artr__item__menu_item" href="${it.support}" target="_blank" title="Support Artist"><span class="fas fa-shopping-cart"></span></a>`)
					: null;

				const $lnk = $$`<a href="${it.uri}" target="_blank" class="artr__item__lnk-fullsize" draggable="true">
					<img class="artr__item__thumbnail" src="${urlThumb}">
				</a>`
					.on("dragstart", evt => {
						const meta = {
							type: "ve-Art",
							uri: it.uri
						};
						evt.originalEvent.dataTransfer.setData("application/json", JSON.stringify(meta));
					});

				return $$`<div class="artr__item__wrp relative">
					${$lnk}
					<div class="artr__item__menu">${$btnCopyUrl}${$btnSupport}</div>
				</div>`;
			})

		const $wrpItem = $$`<div class="artr__item__top artr__item__top--expanded artr__item__top--expanded-sub-page">
			${$eles}
		</div>`;

		const $btnDownload = $(`<button class="artr__btn-lg artr__btn-primary">Download</button>`)
			.click(() => this._pHandleDownloadClick([this._currentIndexItem], {isSingleMode: true}));

		$$`<div class="flex-col w-100 h-100">
			<div class="artr__item__bottom flex-v-center">
				<div class="mr-2">${this._currentIndexItem._set} <i>by</i> ${this._currentIndexItem._artist} (${(this._currentIndexItem._size || 0).toLocaleString()} images)</div>
				${$btnDownload}
			</div>
			${$wrpItem}
		</div>`.appendTo(this._$itemBodyInner);
	}

	_addSidebarSection (propOrHeader, values, filterStorage, fnSort, ix) {
		const isInitialShowing = !ix; // hide all but first (real) section by default

		const fullName = (() => {
			switch (propOrHeader) {
				case "imageType": return "Image Type";
				case "grid": return "Grid Type";
				case "monster": return "Monster Type";
				case "audience": return "Intended Audience";
				default: return propOrHeader.uppercaseFirst();
			}
		})();

		const $dispToggle = $(`<div>${isInitialShowing ? "[\u2013]" : "[+]"}</div>`);
		const $wrpHead = $$`<div class="artr__side__tag_header mb-1">
			<div>${fullName}</div>
			${$dispToggle}
		</div>`
			.appendTo(this._$sideBody)
			.click(() => {
				$wrpBody.toggleVe();
				$dispToggle.html($dispToggle.html() === "[+]" ? "[\u2013]" : "[+]");
			});

		const getNextState = (state, dir) => {
			const ix = Const.STATES.indexOf(state) + dir;
			if (ix > Const.STATES.length - 1) return Const.STATES[0];
			if (ix < 0) return Const.STATES.last();
			return Const.STATES[ix];
		};

		values.sort(fnSort);
		const btnMetas = values.map(enm => {
			const cycleState = dir => {
				const nxtState = getNextState($btn.attr("data-state"), dir);
				$btn.attr("data-state", nxtState);

				if (nxtState === "0") {
					delete filterStorage[propOrHeader][enm.v];
					if (!Object.keys(filterStorage[propOrHeader]).length) delete filterStorage[propOrHeader];
				} else (filterStorage[propOrHeader] = filterStorage[propOrHeader] || {})[enm.v] = nxtState === "1";

				this._handleHashChange();
			};

			const $btn = $(`<button class="artr__side__tag" data-state="0">${enm.v} (${enm.c})</button>`)
				.click(() => cycleState(1))
				.contextmenu((evt) => {
					if (!evt.ctrlKey) {
						evt.preventDefault();
						cycleState(-1);
					}
				});

			return {
				$btn,
				searchText: (enm.v || "").trim().toLowerCase()
			}
		});

		const $iptSearch = $(`<input placeholder="Filter...">`)
			.change(() => {
				const searchVal = $iptSearch.val().trim().toLowerCase();

				if (!searchVal) btnMetas.forEach(it => it.$btn.showVe());
				else btnMetas.forEach(it => it.$btn.toggleVe(it.searchText.includes(searchVal)));
			})

		const $wrpBody = $$`<div class="flex-col">
			<div class="pb-1 px-1 artr__side__wrp-tag-filter">${$iptSearch}</div>
			<div class="artr__side__tag-grid pb-1 mb-1">${btnMetas.map(it => it.$btn)}</div>
		</div>`
			.toggleVe(isInitialShowing)
			.appendTo(this._$sideBody);
	}

	_addFakeSidebarSection (title, propToCount, filterStorage) {
		const fakeValues = Object.keys(propToCount).sort(SortUtil.ascSort).map(it => ({v: it, c: propToCount[it]})); // [v]alue and [c]ount
		this._addSidebarSection(title, fakeValues, filterStorage, (a, b) => SortUtil.ascSortLower(a.v, b.v), true); // force minimize
	}

	async pInit () {
		const $win = $(`<div class="artr__win"></div>`)
			.appendTo(this._$parent);

		const $dispLoadingSidebar = $(`<div class="artr__side__loading" title="Caching repository data, this may take some time">Loading...</div>`);

		const [enums, index] = await Promise.all([ArtBrowser.pGetJson(`${Const.GH_PATH}_meta_enums.json`), ArtBrowser.pGetJson(`${Const.GH_PATH}_meta_index.json`)]);
		this._index = index;

		Object.keys(this._index).forEach(k => this._index[k]._key = k);

		window.addEventListener("hashchange", this._handleHashChange.bind(this));

		// region sidebar
		const $dispToggleSidebar = $(`<div>[\u2013]</div>`);
		const $sideHead = $$`<div class="artr__side__head split-v-center clickable">
			<div class="artr__side__head__title">Filters</div>
			${$dispToggleSidebar}
		</div>`
			.click(() => {
				$dispToggleSidebar.html($dispToggleSidebar.html() === "[+]" ? "[\u2013]" : "[+]");
				$sidebar.toggleClass("artr__side--minimized");
				this._$sideBody.toggleVe();
			})

		this._$sideBody = $(`<div class="artr__side__body"></div>`);

		const $sidebar = $$`<div class="artr__side">
			${$dispLoadingSidebar}

			${$sideHead}
			${this._$sideBody}
		</div>`.appendTo($win);

		// Index artists/sets, to make fake tag sections
		const artists = {};
		const sets = {};
		Object.values(this._index).forEach(it => {
			artists[it._artist] = artists[it._artist] || 0;
			artists[it._artist] += it._size;
			sets[it._set] = sets[it._set] || 0;
			sets[it._set] += it._size;
		});

		this._addFakeSidebarSection(Const.FAKE_FILTER_ARTIST, artists, this._filtersArtists);
		this._addFakeSidebarSection(Const.FAKE_FILTER_SET, sets, this._filtersSets);
		Object.keys(enums).forEach((k, i) => this._addSidebarSection(k, enums[k], this._filters, (a, b) => SortUtil.ascSort(b.c, a.c), i));
		// endregion

		// region main
		const $mainPane = $(`<div class="artr__main"></div>`).appendTo($win);

		const $dispLoadingMain = $(`<div class="artr__main__loading" title="Caching repository data, this may take some time">Loading...</div>`).appendTo($mainPane)

		this._$wrpBread = $(`<div class="artr__bread"></div>`);
		this._updateCrumbs();

		let searchTimeout;
		const doSearch = () => {
			this._search = ($iptSearch.val() || "").trim();
			this._handleHashChange();
		};
		const $iptSearch = $(`<input placeholder="Search..." class="artr__search__field">`)
			.title(`Multiple search terms can be provided by using quotes, e.g.: "ship" "pirate"`)
			.on("keydown", (e) => {
				clearTimeout(searchTimeout);
				if (e.which === 13) {
					doSearch();
				} else {
					searchTimeout = setTimeout(() => { doSearch(); }, 100);
				}
			});

		const $cbAll = $(`<input type="checkbox" class="mr-2 artr__item__cb-select artr__item__cb-select--all">`)
			.change(() => {
				if (!this._itemMetas) return;
				const toVal = $cbAll.prop("checked");
				this._itemMetas.forEach(it => {
					it.$cbSel.prop("checked", toVal);
					it.fnHandleChangeCbAll(toVal);
				});
			});

		const $btnDownloadSelected = $(`<button class="artr__btn-lg artr__btn-primary" title="Download ZIP (SHIFT to download a text file of URLs)">Download Selected</button>`)
			.click(() => {
				if (!this._itemMetas) return;
				const selected = this._itemMetas.filter(it => it.$cbSel.prop("checked"));
				if (!selected.length) return alert(`Please select some items to download!`);
				const indexItems = selected.map(it => this._index[it.key]);
				return this._pHandleDownloadClick(indexItems);
			});

		let $style = $(`#${ArtBrowser._ID_STYLE_THUMBNAILS}`);
		if (!$style.length) {
			$style = $(`<style id="${ArtBrowser._ID_STYLE_THUMBNAILS}"></style>`).appendTo(document.body);
		}

		let lastThumbnailSize = null;
		const hkThumbnailSize = () => {
			const sliderVal = $sldThumbnailSize.val();
			const size = Math.round(ArtBrowser._SZ_PX_THUMBNAIL * (sliderVal / 100));

			if (lastThumbnailSize === size) return;
			lastThumbnailSize = size;

			$style.html(`
.artr__wrp .artr__item__top {
    height: ${size + ArtBrowser._SZ_PX_MAIN_ROW_HEADER}px;
}

.artr__wrp .artr__item__top--expanded {
	height: initial;
}

.artr__wrp .artr__item__thumbnail {
	min-width: ${size}px;
	min-height: ${size}px;
	max-width: ${size}px;
	max-height: ${size}px;
}`);
			StorageUtil.syncSet(ArtBrowser._STORAGE_KEY_THUMBNAIL_SIZE, sliderVal);
		};
		const $sldThumbnailSize = $(`<input type="range" min="25" max="200" title="Thumbnail Size">`)
			.mousemove(evt => {
				if (evt.currentTarget !== $sldThumbnailSize[0]) return;
				hkThumbnailSize();
			})
			.change(() => {
				hkThumbnailSize();
			});
		let savedThumbnailSize = StorageUtil.syncGet(ArtBrowser._STORAGE_KEY_THUMBNAIL_SIZE);
		if (savedThumbnailSize != null) {
			$sldThumbnailSize.val(Math.min(200, Math.max(25, savedThumbnailSize)));
			hkThumbnailSize();
		}

		const $wrpHeaderControlsMain = $$`<div class="flex-v-center no-shrink">
			${$cbAll}
			${$btnDownloadSelected}
		</div>`;
		const $spcHeaderControlsMain = $(`<div class="artr__search__divider mx-2"></div>`);
		this._$mainHeaderElements = [$wrpHeaderControlsMain, $spcHeaderControlsMain];

		const $mainHead = $$`<div class="p-2 artr__search flex-v-center">
			${$wrpHeaderControlsMain}
			${$spcHeaderControlsMain}
			<div class="flex-col w-100">
				${this._$wrpBread}
				${$iptSearch}
			</div>
			<div class="flex-v-center h-100">
				<div class="artr__search__divider mx-2"></div>
				<div class="flex-col flex-vh-center">
					<div class="mb-1">Thumbnail Size</div>
					${$sldThumbnailSize}
				</div>
			</div>
		</div>`.appendTo($mainPane);

		this._$mainBody = $(`<div class="artr__view"></div>`).appendTo($mainPane);
		this._$mainBodyInner = $(`<div class="artr__view_inner"></div>`).appendTo(this._$mainBody);

		this._$itemBody = $(`<div class="artr__view"></div>`).hideVe().appendTo($mainPane);
		this._$itemBodyInner = $(`<div class="artr__view_inner"></div>`).appendTo(this._$itemBody);

		this._handleHashChange();

		[
			$dispLoadingSidebar,
			$dispLoadingMain
		].forEach($l => $l.remove());
		// endregion
	}

	/**
	 * @param indexItems
	 * @param [opts]
	 * @param [opts.isSingleMode]
	 */
	async _pHandleDownloadClick (indexItems, opts) {
		opts = opts || {};

		const {$modalInner, doClose} = this._$getShowModal();

		$modalInner
			.addClass("flex-vh-center")
			.append(`<div class="flex-vh-center"><i>Collecting data...</i></div>`);

		const jsons = await Promise.all(indexItems.map(indexItem => ArtBrowser.pGetJson(`${Const.GH_PATH}${indexItem._key}.json`)));

		$modalInner.empty();

		const options = await this._pGetDownloadModes();

		const $selMode = $(`<select>
			${options.map((it, ix) => `<option value="${ix}" ${ix === 0 ? "selected" : ""}>${it.name}</option>`).join("")}
		</select>`)
			.change(() => {
				if (!$wrpCb) return;
				const option = options[Number($selMode.val())];
				$wrpCb.toggleVe(!option.isMultipleFilesOnly);
			});

		const $cbFilePerItem = $(`<input type="checkbox" checked>`);

		const $btnDownload = $(`<button class="artr__btn-lg artr__btn-primary">Download</button>`)
			.click(async () => {
				doClose();

				try {
					const isSingleFile = !$cbFilePerItem.prop("checked");
					const option = options[Number($selMode.val())];

					if (isSingleFile && !option.isMultipleFilesOnly) {
						await option.pDownloadAsSingleFile(...jsons);
					} else {
						const len = jsons.length;
						for (let i = 0; i < len; ++i) {
							const json = jsons[i];
							await option.pDownloadAsMultipleFiles(json, i, len);
							await MiscUtil.pDelay(33);
						}
					}
				} catch (e) {
					alert(`Download failed! See the console (CTRL+SHIFT+J) for details.`)
					throw e;
				}
			});

		const $wrpCb = indexItems.length > 1 ? $$`<label class="p-0 m-0 mb-2 flex-v-center" title="If the download should be a single file per selected item, as opposed to the default of one file containing all items."><div class="mr-2">One file per item</div>${$cbFilePerItem}</label>` : null;
		$selMode.change();

		$$`<div class="flex-col">
			${opts.isSingleMode ? "" : `<div class="flex-v-center mb-2"><i>${indexItems.length} item${indexItems.length === 1 ? "" : "s"} selected</i></div>`}
			<label class="p-0 m-0 mb-2 flex-v-center"><div class="mr-2">Format</div>${$selMode}</label>
			${$wrpCb}
			<div class="flex-vh-center mt-auto w-100">${$btnDownload}</div>
		</div>`.appendTo($modalInner);
	}

	get _textDownloadMode () {
		return {
			name: "Text",
			pDownloadAsSingleFile: (jsons) => this._downloadHelper.downloadUrls(...jsons),
			pDownloadAsMultipleFiles: (json) => this._downloadHelper.downloadUrls(json)
		};
	}

	get _jsonDownloadMode () {
		return {
			name: "JSON",
			pDownloadAsSingleFile: (jsons) => this._downloadHelper.downloadJson(...jsons),
			pDownloadAsMultipleFiles: (json) => this._downloadHelper.downloadJson(json)
		};
	}

	/**
	 * To be overridden externally.
	 * First item is default selected.
	 */
	async _pGetDownloadModes () {
		return [
			this._textDownloadMode,
			this._jsonDownloadMode,
			{
				name: "ZIP (Warning: rate-limited)",
				pDownloadAsSingleFile: (jsons) => this._downloadHelper.downloadZip(...jsons),
				pDownloadAsMultipleFiles: (json) => this._downloadHelper.downloadZip(json)
			}
		]
	}

	_$getShowModal () {
		const doClose = () => {
			$wrpOverlay.remove();
		};

		const $wrpModal = $(`<div class="flex-col artr__modal__wrp p-2"></div>`);
		const $wrpOverlay = $$`<div class="flex-vh-center artr__modal__overlay">${$wrpModal}</div>`
			.click(evt => {
				if (evt.target === $wrpOverlay[0]) doClose();
			})
			.appendTo(this._$parent);

		return {$modalInner: $wrpModal, doClose};
	}

	_addScrollHandlers () {
		const config = {
			rootMargin: "0px 0px",
			threshold: 0.01
		};

		this._itemObservers.forEach(it => it.disconnect());
		this._itemObservers = [];

		this._itemMetas.forEach(meta => {
			const observer = new IntersectionObserver(
				obsEntries => {
					obsEntries.forEach(entry => {
						if (entry.intersectionRatio > 0) { // filter observed entries for those that intersect
							observer.unobserve(entry.target);

							meta.fnOnIntersect();
						}
					});
				},
				config
			);

			observer.observe(meta.$item[0]);
			this._itemObservers.push(observer);
		})
	}

	_addHorizontalScrollHandler (intersectionMetas) {
		const observer = new IntersectionObserver(
			obsEntries => {
				obsEntries.forEach(entry => {
					if (entry.intersectionRatio > 0) { // filter observed entries for those that intersect
						const eleImg = entry.target;
						observer.unobserve(eleImg);

						const meta = intersectionMetas.find(meta => meta.eleImg === eleImg);
						if (!meta) return; // should never occur
						meta.eleImg.src = meta.urlThumb;
					}
				});
			},
			{
				rootMargin: "0px 0px",
				threshold: 0.01
			}
		);

		intersectionMetas.forEach(meta => observer.observe(meta.eleImg));
	}
}
ArtBrowser._JSON_CACHE = {};
ArtBrowser._JSON_FETCHING = {};
ArtBrowser._ID_STYLE_THUMBNAILS = "artr__style__thumbnails";
ArtBrowser._SZ_PX_MAIN_ROW_HEADER = 18;
ArtBrowser._SZ_PX_THUMBNAIL = 180;
ArtBrowser._STORAGE_KEY_THUMBNAIL_SIZE = "artr__style__thumbnails";

export {ArtBrowser};
