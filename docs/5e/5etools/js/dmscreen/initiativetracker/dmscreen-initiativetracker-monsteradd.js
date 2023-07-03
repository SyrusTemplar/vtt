class _MonstersToLoad {
	constructor (
		{
			count,
			nameMeta,
			source,
			isRollHp,
		},
	) {
		this.count = count;
		this.nameMeta = nameMeta;
		this.source = source;
		this.isRollHp = isRollHp;
	}
}

export class InitiativeTrackerMonsterAdd extends BaseComponent {
	static _RESULTS_MAX_DISPLAY = 75; // hard cap at 75 results

	constructor ({board, isRollHp}) {
		super();
		this._board = board;

		this._state.isRollHp = isRollHp;
	}

	_getDefaultState () {
		return {
			isRollHp: false,
			cntToAdd: 1,
			cntToAddCustom: 13,
		};
	}

	_getCntToAdd () {
		return this._state.cntToAdd === -1
			? Math.max(1, this._state.cntToAddCustom)
			: this._state.cntToAdd;
	}

	/* -------------------------------------------- */

	_$getCbCntToAdd ({cnt}) {
		const $cb = $(`<input type="radio" class="ui-search__ipt-search-sub-ipt">`);
		$cb.on("change", () => {
			this._state.cntToAdd = cnt;
		});
		this._addHookBase("cntToAdd", () => $cb.prop("checked", this._state.cntToAdd === cnt))();
		return $cb;
	}

	_$getIptCntToAddCustom () {
		const $iptCntToAddCustom = ComponentUiUtil.$getIptInt(
			this,
			"cntToAddCustom",
			1,
			{
				html: `<input type="number" class="form-control ui-search__ipt-search-sub-ipt-custom">`,
				min: 1,
			},
		);

		this._addHookBase("cntToAdd", () => {
			if (this._state.cntToAdd !== -1) return;
			$iptCntToAddCustom.select();
		})();

		$iptCntToAddCustom.click(() => {
			this._state.cntToAdd = -1;
		});

		return $iptCntToAddCustom;
	}

	/**
	 * @return {Promise<[boolean, _MonstersToLoad]>}
	 */
	async pGetShowModalResults () {
		const flags = {
			doClickFirst: false,
			isWait: false,
		};

		const {$modalInner, doClose, pGetResolved} = UiUtil.getShowModal();

		const $iptSearch = $(`<input class="ui-search__ipt-search search form-control" autocomplete="off" placeholder="Search...">`)
			.blurOnEsc();

		$$`<div class="split no-shrink">
			${$iptSearch}

			<div class="ui-search__ipt-search-sub-wrp ve-flex-v-center pr-0">
				<div class="mr-1">Add</div>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 1})} 1</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 2})} 2</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 3})} 3</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 5})} 5</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 8})} 8</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: -1})} ${this._$getIptCntToAddCustom()}</label>
			</div>

			<label class="ui-search__ipt-search-sub-wrp ve-flex-vh-center">${ComponentUiUtil.$getCbBool(this, "isRollHp").addClass("mr-1")} <span>Roll HP</span></label>
		</div>`.appendTo($modalInner);

		const $results = $(`<div class="ui-search__wrp-results"></div>`).appendTo($modalInner);

		const showMsgIpt = () => {
			flags.isWait = true;
			$results.empty().append(SearchWidget.getSearchEnter());
		};

		const showMsgDots = () => $results.empty().append(SearchWidget.getSearchLoading());

		const showNoResults = () => {
			flags.isWait = true;
			$results.empty().append(SearchWidget.getSearchNoResults());
		};

		const $ptrRows = {_: []};

		const doSearch = () => {
			const srch = $iptSearch.val().trim();

			const index = this._board.availContent["Creature"];
			const results = index.search(srch, {
				fields: {
					n: {boost: 5, expand: true},
					s: {expand: true},
				},
				bool: "AND",
				expand: true,
			});
			const resultCount = results.length ? results.length : index.documentStore.length;
			const toProcess = results.length ? results : Object.values(index.documentStore.docs).slice(0, 75).map(it => ({doc: it}));

			$results.empty();
			$ptrRows._ = [];
			if (toProcess.length) {
				const handleClick = async res => {
					await doClose(
						true,
						new _MonstersToLoad({
							count: this._getCntToAdd(),
							nameMeta: {
								name: res.doc.n,
							},
							source: res.doc.s,
							isRollHp: this._state.isRollHp,
						}),
					);
				};

				const $getRow = (res) => {
					return $(`
						<div class="ui-search__row" tabindex="0">
							<span>${res.doc.n}</span>
							<span>${res.doc.s ? `<i title="${Parser.sourceJsonToFull(res.doc.s)}">${Parser.sourceJsonToAbv(res.doc.s)}${res.doc.p ? ` p${res.doc.p}` : ""}</i>` : ""}</span>
						</div>
					`);
				};

				if (flags.doClickFirst) {
					handleClick(toProcess[0]);
					flags.doClickFirst = false;
					return;
				}

				const results = toProcess.slice(0, this.constructor._RESULTS_MAX_DISPLAY);

				results.forEach(res => {
					const $row = $getRow(res).appendTo($results);
					SearchWidget.bindRowHandlers({result: res, $row, $ptrRows, fnHandleClick: handleClick, $iptSearch});
					$ptrRows._.push($row);
				});

				if (resultCount > this.constructor._RESULTS_MAX_DISPLAY) {
					const diff = resultCount - this.constructor._RESULTS_MAX_DISPLAY;
					$results.append(`<div class="ui-search__row ui-search__row--readonly">...${diff} more result${diff === 1 ? " was" : "s were"} hidden. Refine your search!</div>`);
				}
			} else {
				if (!srch.trim()) showMsgIpt();
				else showNoResults();
			}
		};

		SearchWidget.bindAutoSearch($iptSearch, {
			flags,
			fnSearch: doSearch,
			fnShowWait: showMsgDots,
			$ptrRows,
		});

		$iptSearch.focus();
		doSearch();

		return pGetResolved();
	}
}
