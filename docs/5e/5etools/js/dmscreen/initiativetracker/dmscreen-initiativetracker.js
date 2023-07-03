import {InitiativeTrackerConst} from "./dmscreen-initiativetracker-consts.js";
import {InitiativeTrackerNetworking} from "./dmscreen-initiativetracker-networking.js";
import {InitiativeTrackerUi} from "./dmscreen-initiativetracker-ui.js";
import {InitiativeTrackerSettings} from "./dmscreen-initiativetracker-settings.js";
import {InitiativeTrackerSettingsImport} from "./dmscreen-initiativetracker-importsettings.js";
import {InitiativeTrackerMonsterAdd} from "./dmscreen-initiativetracker-monsteradd.js";
import {InitiativeTrackerRoller} from "./dmscreen-initiativetracker-roller.js";
import {InitiativeTrackerEncounterConverter} from "./dmscreen-initiativetracker-encounterconverter.js";
import {
	InitiativeTrackerStatColumnDataSerializer,
	InitiativeTrackerStatColumnFactory,
	IS_PLAYER_VISIBLE_ALL,
} from "./dmscreen-initiativetracker-statcolumns.js";
import {InitiativeTrackerRowDataSerializer} from "./dmscreen-initiativetracker-rows.js";
import {InitiativeTrackerConditionAdd} from "./dmscreen-initiativetracker-conditionadd.js";

export class InitiativeTracker extends BaseComponent {
	constructor ({board, savedState}) {
		super();

		this._board = board;
		this._savedState = savedState;

		this._networking = new InitiativeTrackerNetworking({board});
		this._roller = new InitiativeTrackerRoller();
	}

	// TODO(DMS) need to make sure old proxy is cleaned up when destroying old tracker (i.e. on `.render()`?)
	render () {
		this._setStateFromSerialized();

		// TODO(DMS) collapse
		const rowMetas = [];
		const getRowMetaByElement = $row => rowMetas.find(({$wrpRow}) => $row[0] === $wrpRow[0]);

		const $wrpTracker = $(`<div class="dm-init dm__panel-bg dm__data-anchor"></div>`);

		const p2pMetaV1 = {rows: [], serverInfo: null, serverPeer: null};
		const p2pMetaV0 = {rows: [], serverInfo: null};
		const _sendStateToClients = () => {
			// region V1
			if (p2pMetaV1.serverPeer) {
				if (!p2pMetaV1.serverPeer.hasConnections()) return;

				const toSend = getPlayerFriendlyState();
				p2pMetaV1.serverPeer.sendMessage(toSend);
			}
			// endregion

			// region V0
			if (p2pMetaV0.serverInfo) {
				p2pMetaV0.rows = p2pMetaV0.rows.filter(row => !row.isDeleted);
				p2pMetaV0.serverInfo = p2pMetaV0.serverInfo.filter(row => {
					if (row.isDeleted) {
						row.server.close();
						return false;
					}
					return true;
				});

				const toSend = getPlayerFriendlyState();
				try {
					p2pMetaV0.serverInfo.filter(info => info.server.isActive).forEach(info => info.server.sendMessage(toSend));
				} catch (e) { setTimeout(() => { throw e; }); }
			}
			// endregion
		};
		const sendStateToClientsDebounced = MiscUtil.debounce(_sendStateToClients, 100); // long delay to avoid network spam

		const doUpdateExternalStates = () => {
			this._board.doSaveStateDebounced();
			sendStateToClientsDebounced();
		};

		const pDoLoadEncounter = async ({entityInfos, encounterInfo}) => {
			const nxtState = await new InitiativeTrackerEncounterConverter({
				roller: this._roller,

				importIsAddPlayers: this._state.importIsAddPlayers,
				importIsRollGroups: this._state.importIsRollGroups,
				isRollInit: this._state.isRollInit,
				isRollHp: this._state.isRollHp,
			}).pGetConverted({entityInfos, encounterInfo});

			this._proxyAssignSimple(
				"state",
				{
					isStatsAddColumns: nxtState.isStatsAddColumns,
					statsCols: nxtState.statsCols
						.map(it => it.getAsStateData()),
					rows: nxtState.rows,
				},
			);

			await pDoRefreshTracker({isAppend: this._state.importIsAppend});
		};

		// initialise "upload" context menu
		const menu = ContextUtil.getMenu([
			...ListUtilBestiary.getContextOptionsLoadSublist({
				pFnOnSelect: pDoLoadEncounter.bind(this),
			}),
			null,
			new ContextUtil.Action(
				"Import Settings",
				async () => {
					const compImportSettings = new InitiativeTrackerSettingsImport({state: MiscUtil.copyFast(this._state)});
					await compImportSettings.pGetShowModalResults();
					Object.assign(this._state, compImportSettings.getSettingsUpdate());
				},
			),
		]);

		const $wrpTop = $(`<div class="dm-init__wrp-header-outer"></div>`).appendTo($wrpTracker);
		const $wrpHeader = $(`
			<div class="dm-init__wrp-header">
				<div class="dm-init__row-lhs dm-init__header">
					<div class="w-100">Creature/Status</div>
				</div>

				<div class="dm-init__row-mid"></div>

				<div class="dm-init__row-rhs">
					<div class="dm-init__header dm-init__header--input dm-init__header--input-wide" title="Hit Points">HP</div>
					<div class="dm-init__header dm-init__header--input" title="Initiative Score">#</div>
					<div class="dm-init__spc-header-buttons"></div>
				</div>
			</div>
		`).appendTo($wrpTop);

		const $wrpEntries = $(`<div class="dm-init__wrp-entries"></div>`).appendTo($wrpTop);

		const $wrpControls = $(`<div class="dm-init__wrp-controls"></div>`).appendTo($wrpTracker);

		const $btnAdd = $(`<button class="btn btn-primary btn-xs dm-init-lockable" title="Add Player"><span class="glyphicon glyphicon-plus"></span></button>`);
		const $btnAddMonster = $(`<button class="btn btn-success btn-xs dm-init-lockable mr-2" title="Add Monster"><span class="glyphicon glyphicon-print"></span></button>`);

		const $btnSetPrevActive = $(`<button class="btn btn-default btn-xs" title="Previous Turn"><span class="glyphicon glyphicon-step-backward"></span></button>`)
			.click(() => setPrevActive());
		const $btnSetNextActive = $(`<button class="btn btn-default btn-xs mr-2" title="Next Turn"><span class="glyphicon glyphicon-step-forward"></span></button>`)
			.click(() => setNextActive());
		const $iptRound = $(`<input class="form-control ipt-sm dm-init__rounds" type="number" min="1" title="Round">`)
			.val(this._savedState.n || 1)
			.change(() => doUpdateExternalStates());

		$$`<div class="ve-flex">
			<div class="btn-group ve-flex">
				${$btnAdd}
				${$btnAddMonster}
			</div>
			<div class="btn-group">${$btnSetPrevActive}${$btnSetNextActive}</div>
			${$iptRound}
		</div>`.appendTo($wrpControls);

		const $wrpSort = $(`<div class="btn-group ve-flex"></div>`).appendTo($wrpControls);
		$(`<button title="Sort Alphabetically" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-sort-by-alphabet"></span></button>`).appendTo($wrpSort)
			.click(() => {
				if (this._state.sort === InitiativeTrackerConst.SORT_ORDER_ALPHA) this._doReverseSortDir();
				else this._state.sort = InitiativeTrackerConst.SORT_ORDER_ALPHA;
				doSort(InitiativeTrackerConst.SORT_ORDER_ALPHA);
			});
		$(`<button title="Sort Numerically" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-sort-by-order"></span></button>`).appendTo($wrpSort)
			.click(() => {
				if (this._state.sort === InitiativeTrackerConst.SORT_ORDER_NUM) this._doReverseSortDir();
				else this._state.sort = InitiativeTrackerConst.SORT_ORDER_NUM;
				doSort(InitiativeTrackerConst.SORT_ORDER_NUM);
			});

		const $wrpUtils = $(`<div class="ve-flex"></div>`).appendTo($wrpControls);

		const menuPlayerWindow = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Standard",
				async () => {
					this._networking.handleClick_playerWindowV1({p2pMetaV1, doUpdateExternalStates});
				},
			),
			new ContextUtil.Action(
				"Manual (Legacy)",
				async () => {
					this._networking.handleClick_playerWindowV0({p2pMetaV0, doUpdateExternalStates});
				},
			),
		]);

		$(`<button class="btn btn-primary btn-xs mr-2" title="Player View"><span class="glyphicon glyphicon-user"></span></button>`)
			.click(evt => {
				ContextUtil.pOpenMenu(evt, menuPlayerWindow);
			})
			.appendTo($wrpUtils);

		$wrpTracker.data("pDoConnectLocalV1", async () => {
			await this._networking.startServerV1({p2pMetaV1, doUpdateExternalStates});
			return p2pMetaV1.serverPeer.token;
		});

		$wrpTracker.data("pDoConnectLocalV0", async (clientView) => {
			await this._networking.pHandleDoConnectLocalV0({p2pMetaV0, clientView});
			sendStateToClientsDebounced();
		});

		const $wrpLockSettings = $(`<div class="btn-group ve-flex"></div>`).appendTo($wrpUtils);
		const $btnLock = $(`<button class="btn btn-danger btn-xs" title="Lock Tracker"><span class="glyphicon glyphicon-lock"></span></button>`).appendTo($wrpLockSettings);
		$btnLock.on("click", () => {
			if (this._state.isLocked) {
				$btnLock.removeClass("btn-success").addClass("btn-danger").title("Lock Tracker");
				$(".dm-init-lockable").removeClass("disabled");
				$("input.dm-init-lockable").prop("disabled", false);
			} else {
				$btnLock.removeClass("btn-danger").addClass("btn-success").title("Unlock Tracker");
				$(".dm-init-lockable").addClass("disabled");
				$("input.dm-init-lockable").prop("disabled", true);
			}
			this._state.isLocked = !this._state.isLocked;
			handleStatColsChange();
		});

		$(`<button class="btn btn-default btn-xs mr-2" title="Settings"><span class="glyphicon glyphicon-cog"></span></button>`)
			.appendTo($wrpLockSettings)
			.click(async () => {
				const compSettings = new InitiativeTrackerSettings({state: MiscUtil.copyFast(this._state)});
				await compSettings.pGetShowModalResults();
				Object.assign(this._state, compSettings.getSettingsUpdate());
				handleStatColsChange();
				doUpdateExternalStates();
			});

		const $wrpLoadReset = $(`<div class="btn-group"></div>`).appendTo($wrpUtils);
		const $btnLoad = $(`<button title="Import an encounter from the Bestiary" class="btn btn-success btn-xs dm-init-lockable"><span class="glyphicon glyphicon-upload"></span></button>`).appendTo($wrpLoadReset)
			.click((evt) => {
				if (this._state.isLocked) return;
				ContextUtil.pOpenMenu(evt, menu);
			});
		$(`<button title="Reset" class="btn btn-danger btn-xs dm-init-lockable"><span class="glyphicon glyphicon-trash"></span></button>`).appendTo($wrpLoadReset)
			.click(async () => {
				if (this._state.isLocked) return;
				if (!await InputUiUtil.pGetUserBoolean({title: "Reset", htmlDescription: "Are you sure?", textYes: "Yes", textNo: "Cancel"})) return;
				doReset();
			});

		$btnAdd.on("click", async () => {
			if (this._state.isLocked) return;
			await pMakeRow({isVisible: true});
			doSort(this._state.sort);
			checkSetFirstActive({isSkipUpdateRound: true});
		});

		$btnAddMonster.on("click", async () => {
			if (this._state.isLocked) return;

			const [isDataEntered, monstersToLoad] = await new InitiativeTrackerMonsterAdd({board: this._board})
				.pGetShowModalResults();
			if (!isDataEntered) return;

			this._state.isRollHp = monstersToLoad.isRollHp;

			for (let i = 0; i < monstersToLoad.count; ++i) {
				await pMakeRow({
					nameMeta: monstersToLoad.nameMeta,
					source: monstersToLoad.source,
					isRollHp: monstersToLoad.isRollHp,
				});
			}

			doSort(this._state.sort);
			checkSetFirstActive({isSkipUpdateRound: true});
			doUpdateExternalStates();
		});

		function getStatColsState ($row) {
			return $row.find(`.dm-init__stat`).map((i, e) => {
				const $ipt = $(e).find(`input`);
				const isCb = $ipt.attr("type") === "checkbox";
				return {
					value: isCb ? $ipt.prop("checked") : $ipt.val(),
					id: $(e).attr("data-id"),
				};
			}).get();
		}

		const getSaveableState = () => {
			const rows = $wrpEntries.find(`.dm-init__row`).map((i, e) => {
				const $row = $(e);
				const rowMeta = getRowMetaByElement($row);
				const $iptDisplayName = $row.find(`input.displayName`);
				const customName = $row.hasClass(`dm-init__row-rename`) ? $row.find(`.dm-init__row-link-name`).text() : null;
				const nameMeta = $iptDisplayName.length
					? {
						name: $row.find(`input.name`).val(),
						displayName: $iptDisplayName.val(),
						scaledCr: $row.find(`input.scaledCr`).val() || "",
						scaledSummonSpellLevel: $row.find(`input.scaledSummonSpellLevel`).val() || "",
						scaledSummonClassLevel: $row.find(`input.scaledSummonClassLevel`).val() || "",
					}
					: {
						name: $row.find(`input.name`).val(),
					};
				const out = {
					nameMeta,
					rowStatColData: getStatColsState($row),
					hpCurrent: $row.find(`input.hp`).val(),
					hpMax: $row.find(`input.hp-max`).val(),
					initiative: $row.find(`input.score`).val(),
					isActive: 0 + $row.hasClass(`dm-init__row-active`),
					source: $row.find(`input.source`).val(),
					conditions: rowMeta ? rowMeta.comp._state.conditions : [],
					isPlayerVisible: $row.find(`.dm-init__btn_eye`).hasClass(`btn-primary`),
				};
				if (customName) out.m = customName;
				return out;
			}).get();

			return {
				...this._getSerializedState({rows}),
				n: $iptRound.val(),
			};
		};

		const getPlayerFriendlyState = () => {
			const visibleStatsCols = this._state.statsCols
				.filter(data => data.isPlayerVisible)
				.map(({id, abbreviation, isPlayerVisible}) => ({id, abbreviation, isPlayerVisible}));

			const rows = $wrpEntries.find(`.dm-init__row`).map((i, e) => {
				const $row = $(e);

				// if the row is player-hidden
				if (!$row.find(`.dm-init__btn_eye`).hasClass(`btn-primary`)) return false;

				const isMonster = !!$row.find(`.dm-init__wrp-creature`).length;

				const statCols = getStatColsState($row)
					.map(it => {
						const mappedCol = visibleStatsCols.find(sc => sc.id === it.id);
						if (!mappedCol) return null;

						if (mappedCol.isPlayerVisible === IS_PLAYER_VISIBLE_ALL || !isMonster) return it;
						else return {isUnknown: true};
					})
					.filter(Boolean);

				const rowMeta = getRowMetaByElement($row);

				const out = {
					nameMeta: {
						name: $row.find(`input.name`).val(),
					},
					initiative: $row.find(`input.score`).val(),
					isActive: 0 + $row.hasClass(`dm-init__row-active`),
					conditions: rowMeta ? rowMeta.comp._state.conditions : [],
					rowStatColData: statCols,
				};

				if ($row.hasClass("dm-init__row-rename")) {
					out.nameMeta.customName = $row.find(`.dm-init__row-link-name`).text();
				}

				const hp = Number($row.find(`input.hp`).val());
				const hpMax = Number($row.find(`input.hp-max`).val());
				if ((!isMonster && this._state.playerInitShowExactPlayerHp) || (isMonster && this._state.playerInitShowExactMonsterHp)) {
					out.hpCurrent = hp;
					out.hpMax = hpMax;
				} else {
					out.hpWoundLevel = isNaN(hp) || isNaN(hpMax) ? -1 : InitiativeTrackerUtil.getWoundLevel(100 * hp / hpMax);
				}
				if (this._state.playerInitShowOrdinals) out.ordinal = $row.find(`.dm-init__number`).attr("data-number");

				return out;
			}).get().filter(Boolean);

			visibleStatsCols.forEach(it => delete it.isPlayerVisible); // clean up any visibility mode flags

			return {
				rows,
				statsCols: visibleStatsCols,
				n: $iptRound.val(),
			};
		};

		$wrpTracker.data("getState", getSaveableState.bind(this));
		$wrpTracker.data("getSummary", () => {
			const nameList = $wrpEntries.find(`.dm-init__row`).map((i, e) => $(e).find(`input.name`).val()).get();
			const nameListFilt = nameList.filter(it => it.trim());
			return `${nameList.length} creature${nameList.length === 1 ? "" : "s"} ${nameListFilt.length ? `(${nameListFilt.slice(0, 3).join(", ")}${nameListFilt.length > 3 ? "..." : ""})` : ""}`;
		});

		function shiftActiveRow (direction) {
			const $rows = $wrpEntries.find(`.dm-init__row`);

			const $rowsActive = $rows.filter(`.dm-init__row-active`);

			(~direction ? $rowsActive.get() : $rowsActive.get().reverse())
				.forEach(e => {
					const $row = $(e);

					if (~direction) {
						// tick down any conditions
						const rowMetaTick = getRowMetaByElement($row);
						if (rowMetaTick) {
							rowMetaTick.comp._state.conditions = rowMetaTick.comp._state.conditions
								.filter(cond => !(cond.entity.turns != null && (--cond.entity.turns <= 0)));
						}
					}

					$row.removeClass(`dm-init__row-active`);
				});

			let ix = $rows.index($rowsActive.get(~direction ? $rowsActive.length - 1 : 0)) + direction;

			const nxt = $rows.get(ix);
			ix += direction;
			if (nxt) {
				const $nxt = $(nxt);
				let $curr = $nxt;
				do {
					// if names and initiatives are the same, skip forwards (groups of monsters)
					if ($curr.find(`input.name`).val() === $nxt.find(`input.name`).val()
						&& $curr.find(`input.score`).val() === $nxt.find(`input.score`).val()) {
						handleTurnStart($curr);
						const curr = $rows.get(ix);
						ix += direction;
						if (curr) $curr = $(curr);
						else $curr = null;
					} else break;
				} while ($curr);
			} else checkSetFirstActive();
			doUpdateExternalStates();
		}

		function setNextActive () { shiftActiveRow(1); }
		function setPrevActive () { shiftActiveRow(-1); }

		const handleTurnStart = ($row) => {
			$row.addClass(`dm-init__row-active`);

			if (this._state.statsAddColumns) {
				this._state.statsCols
					.map(data => InitiativeTrackerStatColumnFactory.fromStateData({data}))
					.filter(meta => {
						// TODO(Future) enable/implement for non-checkbox columns
						if (!meta.isCheckbox()) return false;
						return meta.getAutoTurnStartValue() !== undefined;
					})
					.forEach(meta => {
						const $lbl = $row.find(`[data-id=${meta.id}]`);
						$lbl.find(`input`).prop("checked", meta.getAutoTurnStartValue());
					});
			}
		};

		const pMakeRow = async (opts) => {
			let {
				nameMeta,
				customName,
				hp,
				hpMax,
				init,
				isActive,
				source,
				conditions,
				isRollInit,
				isRollHp,
				statsCols,
				isVisible,
			} = Object.assign({
				nameMeta: {name: ""},
				customName: "",
				hp: "",
				hpMax: "",
				init: "",
				conditions: [],
				isRollInit: this._state.isRollInit,
				isRollHp: false,
				isVisible: !this._state.playerInitHideNewMonster,
			}, opts || {});

			const isMon = !!source;

			nameMeta = MiscUtil.copy(nameMeta);
			nameMeta.scaledToCr = nameMeta.scaledToCr != null ? Number(nameMeta.scaledToCr) : null;
			nameMeta.scaledToSummonSpellLevel = nameMeta.scaledToSummonSpellLevel != null ? Number(nameMeta.scaledToSummonSpellLevel) : null;
			nameMeta.scaledToSummonClassLevel = nameMeta.scaledToSummonClassLevel != null ? Number(nameMeta.scaledToSummonClassLevel) : null;
			const displayName = nameMeta.displayName;
			const name = nameMeta.name;

			// TODO(DMS) hoist
			const comp = BaseComponent.fromObject(
				{
					conditions: MiscUtil.copyFast(conditions),
				},
				"*",
			);
			comp._addHookAllBase(() => {
				doUpdateExternalStates();
			});

			const $wrpRow = $(`<div class="dm-init__row ${isActive ? "dm-init__row-active" : ""} overflow-hidden"></div>`);

			const $wrpLhs = $(`<div class="dm-init__row-lhs"></div>`).appendTo($wrpRow);
			const $iptName = $(`<input class="form-control input-sm name dm-init__ipt-name dm-init-lockable dm-init__row-input ${isMon ? "hidden" : ""}" placeholder="Name">`)
				.disableSpellcheck()
				.val(name)
				.appendTo($wrpLhs);
			$iptName.on("change", () => {
				doSort(InitiativeTrackerConst.SORT_ORDER_ALPHA);
				doUpdateExternalStates();
			});
			if (isMon) {
				const $rows = $wrpEntries.find(`.dm-init__row`);
				const curMon = $rows.find(".dm-init__wrp-creature").filter((i, e) => $(e).parent().find(`input.name`).val() === name && $(e).parent().find(`input.source`).val() === source);
				let monNum = null;
				if (curMon.length) {
					const $dispsNumber = curMon.map((i, e) => $(e).find(`span[data-number]`).data("number"));
					if (curMon.length === 1 && !$dispsNumber.length) {
						const $r = $(curMon.get(0));
						$r.find(`.dm-init__wrp-creature-link`).append(`<span data-number="1" class="dm-init__number">(1)</span>`);
						monNum = 2;
					} else {
						monNum = $dispsNumber.get().reduce((a, b) => Math.max(Number(a), Number(b)), 0) + 1;
					}
				}

				const getLink = () => {
					if (
						nameMeta.scaledToCr == null
						&& nameMeta.scaledToSummonSpellLevel == null
						&& nameMeta.scaledToSummonClassLevel == null
					) return Renderer.get().render(`{@creature ${name}|${source}}`);

					const parts = [name, source, displayName, nameMeta.scaledToCr != null ? `${VeCt.HASH_SCALED}=${Parser.numberToCr(nameMeta.scaledToCr)}` : nameMeta.scaledToSummonSpellLevel != null ? `${VeCt.HASH_SCALED_SPELL_SUMMON}=${nameMeta.scaledToSummonSpellLevel}` : nameMeta.scaledToSummonClassLevel != null ? `${VeCt.HASH_SCALED_CLASS_SUMMON}=${nameMeta.scaledToSummonClassLevel}` : null];
					return Renderer.get().render(`{@creature ${parts.join("|")}}`);
				};

				const $monName = $(`
					<div class="dm-init__wrp-creature split">
						<span class="dm-init__wrp-creature-link">
							${$(getLink()).attr("tabindex", "-1")[0].outerHTML}
							${monNum ? ` <span data-number="${monNum}" class="dm-init__number">(${monNum})</span>` : ""}
						</span>
					</div>
				`).appendTo($wrpLhs);

				const setCustomName = (name) => {
					$monName.find(`a`).addClass("dm-init__row-link-name").text(name);
					$wrpRow.addClass("dm-init__row-rename");
				};

				if (customName) setCustomName(customName);

				const $wrpBtnsRhs = $(`<div></div>`).appendTo($monName);
				$(`<button class="btn btn-default btn-xs dm-init-lockable" title="Rename" tabindex="-1"><span class="glyphicon glyphicon-pencil"></span></button>`)
					.click(async () => {
						if (this._state.isLocked) return;
						const nuName = await InputUiUtil.pGetUserString({title: "Enter Name"});
						if (nuName == null || !nuName.trim()) return;
						setCustomName(nuName);
						doSort(this._state.sort);
					}).appendTo($wrpBtnsRhs);
				$(`<button class="btn btn-success btn-xs dm-init-lockable" title="Add Another (SHIFT for Roll New)" tabindex="-1"><span class="glyphicon glyphicon-plus"></span></button>`)
					.click(async (evt) => {
						if (this._state.isLocked) return;
						await pMakeRow({
							nameMeta,
							init: evt.shiftKey ? "" : $iptScore.val(),
							isActive: !evt.shiftKey && $wrpRow.hasClass("dm-init__row-active"),
							source,
							isRollHp: this._state.isRollHp,
							statsCols: evt.shiftKey ? null : getStatColsState($wrpRow),
							isVisible: $wrpRow.find(`.dm-init__btn_eye`).hasClass("btn-primary"),
						});
						doSort(this._state.sort);
					}).appendTo($wrpBtnsRhs);

				$(`<input class="source hidden" value="${source}">`).appendTo($wrpLhs);

				if (
					nameMeta.scaledToCr != null
					|| nameMeta.scaledToSummonSpellLevel != null
					|| nameMeta.scaledToSummonClassLevel != null
				) {
					$(`<input class="displayName hidden" value="${displayName}">`).appendTo($wrpLhs);
					if (nameMeta.scaledToCr != null) $(`<input class="scaledCr hidden" value="${nameMeta.scaledToCr}">`).appendTo($wrpLhs);
					if (nameMeta.scaledToSummonSpellLevel != null) $(`<input class="scaledSummonSpellLevel hidden" value="${nameMeta.scaledToSummonSpellLevel}">`).appendTo($wrpLhs);
					if (nameMeta.scaledToSummonClassLevel != null) $(`<input class="scaledSummonClassLevel hidden" value="${nameMeta.scaledToSummonClassLevel}">`).appendTo($wrpLhs);
				}
			}

			const $wrpConds = $(`<div class="split"></div>`).appendTo($wrpLhs);
			const $conds = $(`<div class="init__wrp_conds"></div>`).appendTo($wrpConds);

			const collectionConditions = new RenderableCollectionConditions({
				comp: comp,
				$wrpRows: $conds,
			});

			$(`<button class="btn btn-warning btn-xs dm-init__row-btn dm-init__row-btn-flag" title="Add Condition" tabindex="-1"><span class="glyphicon glyphicon-flag"></span></button>`)
				.appendTo($wrpConds)
				.on("click", async () => {
					const [isDataEntered, conditionToAdd] = await new InitiativeTrackerConditionAdd()
						.pGetShowModalResults();
					if (!isDataEntered) return;

					comp._state.conditions = [
						...comp._state.conditions,
						conditionToAdd,
					];
				});

			$(`<div class="dm-init__row-mid"></div>`).appendTo($wrpRow);

			const $wrpRhs = $(`<div class="dm-init__row-rhs"></div>`).appendTo($wrpRow);
			const hpVals = {
				curHp: hp,
				maxHp: hpMax,
			};

			const doUpdateHpColors = () => {
				const woundLevel = InitiativeTrackerUtil.getWoundLevel(100 * Number($iptHp.val()) / Number($iptHpMax.val()));
				if (~woundLevel) {
					const woundMeta = InitiativeTrackerUtil.getWoundMeta(woundLevel);
					$iptHp.css("color", woundMeta.color);
					$iptHpMax.css("color", woundMeta.color);
				} else {
					$iptHp.css("color", "");
					$iptHpMax.css("color", "");
				}
			};

			const $iptHp = $(`<input class="form-control input-sm hp dm-init__row-input text-right dm-init__hp dm-init__hp--current" value="${hpVals.curHp}">`)
				.change(() => {
					handleMathInput($iptHp, "curHp");
					doUpdateExternalStates();
					doUpdateHpColors();
				})
				.click(() => $iptHp.select())
				.appendTo($wrpRhs);
			$wrpRhs.append(`<div class="dm-init__hp_slash">/</div>`);
			const $iptHpMax = $(`<input class="form-control input-sm hp-max dm-init__row-input dm-init__hp dm-init__hp--max" value="${hpVals.maxHp}">`)
				.change(() => {
					handleMathInput($iptHpMax, "maxHp");
					doUpdateExternalStates();
					doUpdateHpColors();
				})
				.click(() => $iptHpMax.select())
				.appendTo($wrpRhs);

			doUpdateHpColors();

			const $iptScore = $(`<input class="form-control input-sm score dm-init-lockable dm-init__row-input text-center dm-init__ipt--rhs" type="number">`)
				.on("change", () => doSort(InitiativeTrackerConst.SORT_ORDER_NUM))
				.click(() => $iptScore.select())
				.val(init)
				.appendTo($wrpRhs);

			if (isMon && (hpVals.curHp === "" || hpVals.maxHp === "" || init === "")) {
				const doUpdate = async () => {
					const m = await DataLoader.pCacheAndGet(UrlUtil.PG_BESTIARY, source, hash);

					// set or roll HP
					hpVals.curHp = hpVals.maxHp = await this._roller.pGetOrRollHp(m, {isRollHp: isRollHp ?? this._state.isRollHp});
					$iptHp.val(hpVals.curHp);
					$iptHpMax.val(hpVals.maxHp);

					// roll initiative
					if (!init && isRollInit) {
						$iptScore.val(await this._roller.pGetRollInitiative(m));
					}

					doUpdateHpColors();
				};

				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY]({name: name, source: source});
				await doUpdate();
			}

			const handleMathInput = ($ipt, prop) => {
				const nxt = $ipt.val().trim();
				if (nxt && /^[-+0-9]*$/.exec(hpVals[prop]) && /^[-+0-9]*$/.exec(nxt)) {
					const m = /^[+-]\d+/.exec(nxt);
					const parts = nxt.split(/([+-]\d+)/).filter(it => it);
					let temp = 0;
					parts.forEach(p => temp += Number(p));
					if (m) {
						hpVals[prop] = Number(hpVals[prop]) + temp;
					} else if (/[-+]/.exec(nxt)) {
						hpVals[prop] = temp;
					} else {
						hpVals[prop] = Number(nxt);
					}
					$ipt.val(hpVals[prop]);
				} else hpVals[prop] = nxt;
			};

			InitiativeTrackerUi.$getBtnPlayerVisible(isVisible, doUpdateExternalStates, false, "dm-init__row-btn", "dm-init__btn_eye")
				.appendTo($wrpRhs);

			$(`<button class="btn btn-danger btn-xs dm-init__row-btn dm-init-lockable" title="Delete" tabindex="-1"><span class="glyphicon glyphicon-trash"></span></button>`)
				.appendTo($wrpRhs)
				.on("click", () => {
					if (this._state.isLocked) return;
					if ($wrpRow.hasClass(`dm-init__row-active`) && $wrpEntries.find(`.dm-init__row`).length > 1) setNextActive();

					// TODO(DMS)
					rowMetas.splice(rowMetas.indexOf(rowMeta), 1);
					$wrpRow.remove();

					doUpdateExternalStates();
				});

			populateRowStatCols($wrpRow, statsCols);
			comp._addHookBase("conditions", () => collectionConditions.render())();
			$wrpRow.appendTo($wrpEntries);

			doUpdateExternalStates();

			// TODO(DMS)
			const rowMeta = {
				$wrpRow,
				comp,
			};
			rowMetas.push(rowMeta);

			return $wrpRow;
		};

		const populateRowStatCols = ($row, statsCols) => {
			const $mid = $row.find(`.dm-init__row-mid`);

			if (!this._state.statsAddColumns) return $mid.empty();

			const name = $row.find(`.name`).val();
			const source = $row.find(`.source`).val();
			const isMon = !!source;

			const existing = (() => {
				const existing = {};
				if (statsCols) {
					statsCols.forEach(it => existing[it.id] = {id: it.id, value: it.value});
				} else {
					$mid.find(`.dm-init__stat`).each((i, e) => {
						const $e = $(e);
						const id = $e.attr("data-id");
						const $ipt = $e.find(`input`);

						// avoid race conditions -- the input is still to be populated
						if ($ipt.attr("populate-running") === "true") return;

						const isCb = $ipt.attr("type") === "checkbox";
						existing[id] = {
							value: isCb ? $ipt.prop("checked") : $ipt.val(),
							id,
						};
					});
				}
				return existing;
			})();

			$mid.empty();

			this._state.statsCols.forEach(data => {
				const meta = InitiativeTrackerStatColumnFactory.fromStateData({data});

				const $ipt = (() => {
					if (meta.isCheckbox()) {
						const $cb = $(`<input type="checkbox" class="dm-init__stat_ipt" ${!this._state.isLocked && (meta.isEditable || !isMon) ? "" : "disabled"}>`)
							.change(() => doUpdateExternalStates());

						const populate = () => {
							$cb.prop("checked", !!meta.getInitialCellValue());
							doUpdateExternalStates();
						};

						if (meta.constructor.POPULATE_WITH && meta.populateWithPrevious && isMon) { // on changing populate type, re-populate
							populate();
						} else if (existing[meta.id] != null) { // otherwise (or for players) use existing value
							$cb.prop("checked", existing[meta.id].value);
						} else if (meta.constructor.POPULATE_WITH) { // otherwise, populate
							populate();
						}

						return $cb;
					} else {
						const $ipt = $(`<input class="form-control input-sm dm-init__stat_ipt text-center" ${!this._state.isLocked && (meta.isEditable || !isMon) ? "" : "disabled"}>`)
							.change(() => doUpdateExternalStates());

						const populateFromBlock = () => {
							if (isMon && meta) {
								$ipt.attr("populate-running", true);
								const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY]({name: name, source: source});
								const populateStats = async () => {
									const mon = await DataLoader.pCacheAndGet(UrlUtil.PG_BESTIARY, source, hash);
									$ipt.val(meta.getInitialCellValue(mon));
									$ipt.removeAttr("populate-running");
									doUpdateExternalStates();
								};
								populateStats().then(null);
							}
						};

						if (meta.constructor.POPULATE_WITH && meta.populateWithPrevious && isMon) { // on changing populate type, re-populate
							populateFromBlock();
						} else if (existing[meta.id] != null) { // otherwise (or for players) use existing value
							$ipt.val(existing[meta.id].value);
						} else if (meta.constructor.POPULATE_WITH) { // otherwise, populate
							populateFromBlock();
						}
						return $ipt;
					}
				})();

				const eleType = meta.isCheckbox() ? "label" : "div";
				$$`<${eleType} class="dm-init__stat ${meta.isCheckbox() ? "ve-flex-vh-center" : ""}" data-id="${meta.id}">${$ipt}</${eleType}>`
					.appendTo($mid);
			});
		};

		const handleStatColsChange = () => {
			const $wrpHead = $wrpHeader.find(`.dm-init__row-mid`).empty();

			if (this._state.statsAddColumns) {
				this._state.statsCols.forEach(data => {
					const meta = InitiativeTrackerStatColumnFactory.fromStateData({data});
					$wrpHead.append(
						`<div class="dm-init__stat_head" ${meta.constructor.NAME ? `title="${meta.constructor.NAME}"` : ""}>${meta.abbreviation}</div>`,
					);
				});
			}

			const $rows = $wrpEntries.find(`.dm-init__row`);
			$rows.each((i, e) => populateRowStatCols($(e)));
			this._state.statsCols.forEach(data => data.populateWithPrevious = null);
		};

		function checkSetFirstActive ({isSkipUpdateRound = false} = {}) {
			if ($wrpEntries.find(`.dm-init__row`).length && !$wrpEntries.find(`.dm-init__row-active`).length) {
				const $rows = $wrpEntries.find(`.dm-init__row`);
				const $first = $($rows.get(0));
				handleTurnStart($first);
				if ($rows.length > 1) {
					for (let i = 1; i < $rows.length; ++i) {
						const $nxt = $($rows.get(i));
						if ($nxt.find(`input.name`).val() === $first.find(`input.name`).val()
							&& $nxt.find(`input.score`).val() === $first.find(`input.score`).val()) {
							handleTurnStart($nxt);
						} else break;
					}
				}

				if (!isSkipUpdateRound) $iptRound.val(Number($iptRound.val() || 0) + 1);

				doUpdateExternalStates();
			}
		}

		const doSort = (expectedDir) => {
			if (this._state.sort !== expectedDir) return;
			const sorted = $wrpEntries.find(`.dm-init__row`).sort((a, b) => {
				let aVal;
				let bVal;

				if (this._state.sort === InitiativeTrackerConst.SORT_ORDER_ALPHA && $(a).hasClass("dm-init__row-rename")) {
					aVal = $(a).find(".dm-init__row-link-name").text();
				} else aVal = $(a).find(`input.${this._state.sort === InitiativeTrackerConst.SORT_ORDER_ALPHA ? "name" : "score"}`).val();
				if (this._state.sort === InitiativeTrackerConst.SORT_ORDER_ALPHA && $(b).hasClass("dm-init__row-rename")) {
					bVal = $(b).find(".dm-init__row-link-name").text();
				} else bVal = $(b).find(`input.${this._state.sort === InitiativeTrackerConst.SORT_ORDER_ALPHA ? "name" : "score"}`).val();

				let first = 0;
				let second = 0;
				if (this._state.sort === InitiativeTrackerConst.SORT_ORDER_NUM) {
					aVal = Number(aVal);
					bVal = Number(bVal);
					first = this._state.dir === InitiativeTrackerConst.SORT_DIR_ASC ? SortUtil.ascSort(aVal, bVal) : SortUtil.ascSort(bVal, aVal);
				} else {
					let aVal2 = 0;
					let bVal2 = 0;

					const $aNum = $(a).find(`span[data-number]`);
					if ($aNum.length) aVal2 = $aNum.data("number");
					const $bNum = $(b).find(`span[data-number]`);
					if ($bNum.length) bVal2 = $bNum.data("number");

					first = this._state.dir === InitiativeTrackerConst.SORT_DIR_ASC ? SortUtil.ascSortLower(aVal, bVal) : SortUtil.ascSortLower(bVal, aVal);
					second = this._state.dir === InitiativeTrackerConst.SORT_DIR_ASC ? SortUtil.ascSort(aVal2, bVal2) : SortUtil.ascSort(bVal2, aVal2);
				}
				return first || second;
			});
			$wrpEntries.append(sorted);
			doUpdateExternalStates();
		};

		const doReset = () => {
			// TODO(DMS)
			rowMetas.splice(0, rowMetas.length);
			$wrpEntries.empty();
			this._state.sort = InitiativeTrackerConst.SORT_ORDER_NUM;
			this._state.dir = InitiativeTrackerConst.SORT_DIR_DESC;
			$(`.dm-init__rounds`).val(1);
			doUpdateExternalStates();
		};

		let firstLoad = true;
		const pDoRefreshTracker = async ({isAppend = false} = {}) => {
			if (!firstLoad && !isAppend) doReset();
			firstLoad = false;

			for (const row of (this._state.rows || [])) {
				await pMakeRow({
					nameMeta: row.nameMeta,
					customName: row.nameMeta?.customName,
					hp: row.hpCurrent,
					hpMax: row.hpMax,
					init: row.initiative,
					isActive: row.isActive,
					source: row.source,
					conditions: row.conditions,
					statsCols: row.rowStatColData,
					isVisible: row.isPlayerVisible,
					isRollInit: row.initiative == null && this._state.isRollInit,
				});
			}

			doSort(this._state.sort);
			checkSetFirstActive({isSkipUpdateRound: true});
			handleStatColsChange();
			doUpdateExternalStates();
			if (!firstLoad && !isAppend) $(`.dm-init__rounds`).val(1);
		};

		$wrpTracker.data("pDoLoadEncounter", ({entityInfos, encounterInfo}) => pDoLoadEncounter({entityInfos, encounterInfo}));

		pDoRefreshTracker()
			.then(() => doSort(this._state.sort));

		return $wrpTracker;
	}

	/* -------------------------------------------- */

	_doReverseSortDir () {
		this._state.dir = this._state.dir === InitiativeTrackerConst.SORT_DIR_ASC ? InitiativeTrackerConst.SORT_DIR_DESC : InitiativeTrackerConst.SORT_DIR_ASC;
	}

	/* -------------------------------------------- */

	_setStateFromSerialized () {
		const stateNxt = {
			// region Config
			sort: this._savedState.s || InitiativeTrackerConst.SORT_ORDER_NUM,
			dir: this._savedState.d || InitiativeTrackerConst.SORT_DIR_DESC,
			statsCols: (this._savedState.c || [])
				.map(dataSerial => this._setStateFromSerialized_statsCol({dataSerial}))
				.filter(Boolean),
			// endregion

			// region Rows
			rows: (this._savedState.r || [])
				.map(data => InitiativeTrackerRowDataSerializer.fromSerial(data))
				.filter(Boolean),
			// endregion

			// region Temporary
			isLocked: false,
			// endregion
		};

		// region Config
		if (this._savedState.ri != null) stateNxt.isRollInit = this._savedState.ri;
		if (this._savedState.m != null) stateNxt.isRollHp = this._savedState.m;
		if (this._savedState.g != null) stateNxt.importIsRollGroups = this._savedState.g;
		if (this._savedState.p != null) stateNxt.importIsAddPlayers = this._savedState.p;
		if (this._savedState.a != null) stateNxt.importIsAppend = this._savedState.a;
		if (this._savedState.k != null) stateNxt.statsAddColumns = this._savedState.k;
		if (this._savedState.piHp != null) stateNxt.playerInitShowExactPlayerHp = this._savedState.piHp;
		if (this._savedState.piHm != null) stateNxt.playerInitShowExactMonsterHp = this._savedState.piHm;
		if (this._savedState.piV != null) stateNxt.playerInitHideNewMonster = this._savedState.piV;
		if (this._savedState.piO != null) stateNxt.playerInitShowOrdinals = this._savedState.piO;
		// endregion

		this._proxyAssignSimple("state", stateNxt);
	}

	_setStateFromSerialized_statsCol ({dataSerial}) {
		if (!dataSerial) return null;
		return InitiativeTrackerStatColumnFactory.fromStateData({dataSerial})
			.getAsStateData();
	}

	// TODO(DMS) avoid passing in row data; read exclusively from state
	_getSerializedState ({rows = null} = {}) {
		return {
			// region Config
			s: this._state.sort,
			d: this._state.dir,
			ri: this._state.isRollInit,
			m: this._state.isRollHp,
			g: this._state.importIsRollGroups,
			p: this._state.importIsAddPlayers,
			a: this._state.importIsAppend,
			k: this._state.statsAddColumns,
			piHp: this._state.playerInitShowExactPlayerHp,
			piHm: this._state.playerInitShowExactMonsterHp,
			piV: this._state.playerInitHideNewMonster,
			piO: this._state.playerInitShowOrdinals,
			c: (this._state.statsCols || [])
				.map(data => InitiativeTrackerStatColumnDataSerializer.toSerial(data)),
			// endregion

			// region Rows
			r: (rows || this._state.rows || [])
				.map(data => InitiativeTrackerRowDataSerializer.toSerial(data)),
			// endregion
		};
	}

	_getDefaultState () {
		return {
			// region Config
			sort: InitiativeTrackerConst.SORT_ORDER_NUM,
			dir: InitiativeTrackerConst.SORT_DIR_DESC,
			isRollInit: true,
			isRollHp: false,
			importIsRollGroups: true,
			importIsAddPlayers: true,
			importIsAppend: false,
			statsAddColumns: false,
			playerInitShowExactPlayerHp: false,
			playerInitShowExactMonsterHp: false,
			playerInitHideNewMonster: true,
			playerInitShowOrdinals: false,
			statsCols: [],
			// endregion

			// region Rows
			rows: [],
			// endregion

			// region Temporary
			isLocked: false,
			// endregion
		};
	}

	/* -------------------------------------------- */

	static make$Tracker (board, savedState) {
		return new this({board, savedState}).render();
	}
}
